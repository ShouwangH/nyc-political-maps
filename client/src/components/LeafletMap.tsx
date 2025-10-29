// ABOUTME: Renders the council district choropleth and keeps the Leaflet map in sync with vote data.
// ABOUTME: Inputs = vote map from API, Outputs = styled Leaflet layer + load-state callbacks.
import { useEffect, useRef, useState } from 'react';
import L, { type GeoJSON as LeafletGeoJSON } from 'leaflet';
import { feature } from 'topojson-client';
import type { FeatureCollection, Feature } from 'geojson';
import type { VoteStatus, DistrictDetail, VoteActionContext } from '../types';

type Topology = {
  objects: Record<string, unknown>;
};

export type MapLoadState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'error'; message: string };

const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_LAYER_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LeafletMapProps = {
  votes: Record<string, VoteStatus>;
  districtDetails: Record<string, DistrictDetail>;
  action?: VoteActionContext | null;
  onStatusChange?: (state: MapLoadState) => void;
};

type DistrictFeature = Feature & {
  properties: {
    CounDist?: number | string | null;
    [key: string]: unknown;
  } | null;
};

const COLOR_SCALE: Record<VoteStatus, string> = {
  Yes: '#2e8540',
  No: '#c22',
  Abstain: '#d4a017',
  Missing: '#777'
};

const getDistrictId = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const key = String(value).trim();
  return key ? key : null;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });

const formatTooltipDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const buildTooltipHtml = (
  districtValue: unknown,
  votes: Record<string, VoteStatus>,
  districtDetails: Record<string, DistrictDetail>,
  action?: VoteActionContext | null
): string => {
  const districtId = getDistrictId(districtValue);
  const voteStatus = detectVote(districtValue, votes);
  const detail = districtId ? districtDetails[districtId] : undefined;

  const lines: string[] = [];
  const heading = districtId ? `District ${escapeHtml(districtId)}` : 'Unknown district';
  lines.push(`<strong>${heading}</strong>`);

  if (detail) {
    const memberName = escapeHtml(detail.memberName);
    lines.push(memberName);

    if (detail.isSponsor) {
      const voteLabel = detail.rawValue && detail.rawValue !== detail.vote
        ? `${detail.vote} (${detail.rawValue})`
        : detail.vote;
      lines.push(`Sponsor vote: ${escapeHtml(voteLabel)}`);
    }
  }

  const isCommitteeAction = Boolean(
    action && (
      (action.name && /committee/i.test(action.name)) ||
      (action.body && /committee/i.test(action.body))
    )
  );

  if (action && isCommitteeAction) {
    const parts: string[] = [];
    if (action.body) {
      parts.push(escapeHtml(action.body));
    } else if (action.name) {
      parts.push(escapeHtml(action.name));
    }
    const formattedDate = formatTooltipDate(action.date);
    if (formattedDate) {
      parts.push(formattedDate);
    }
    if (parts.length) {
      lines.push(parts.join(' · '));
    }
  }

  return lines.join('<br />');
};

const detectVote = (district: unknown, votes: Record<string, VoteStatus>): VoteStatus => {
  if (district === null || district === undefined) {
    return 'Missing';
  }
  const key = String(district).trim();
  if (!key) {
    return 'Missing';
  }
  return votes[key] ?? 'Missing';
};

const styleFeature = (feature: DistrictFeature, votes: Record<string, VoteStatus>) => {
  const districtValue = feature.properties?.CounDist ?? null;
  const vote = detectVote(districtValue, votes);

  return {
    color: '#222',
    weight: 1,
    fillOpacity: 0.75,
    fillColor: COLOR_SCALE[vote]
  };
};

export const LeafletMap = ({ votes, districtDetails, action, onStatusChange }: LeafletMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<LeafletGeoJSON<DistrictFeature> | null>(null);

  const [featureCollection, setFeatureCollection] = useState<FeatureCollection | null>(null);
  const [loadState, setLoadState] = useState<MapLoadState>({ type: 'idle' });

  useEffect(() => {
    onStatusChange?.(loadState);
  }, [loadState, onStatusChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (!mapRef.current) {
      mapRef.current = L.map(container, {
        zoomControl: false,
        attributionControl: true
      });

      L.tileLayer(TILE_LAYER_URL, {
        attribution: TILE_LAYER_ATTRIBUTION,
        maxZoom: 18
      }).addTo(mapRef.current);
    }

    const abortController = new AbortController();

    const loadData = async () => {
      try {
        setLoadState({ type: 'loading' });
        const response = await fetch('/data/nyc_council_districts.topo.json', {
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch shapes (${response.status})`);
        }

        const topo = (await response.json()) as Topology;
        if (!('objects' in topo)) {
          throw new Error('Invalid TopoJSON payload');
        }
        const objectName = Object.keys(topo.objects)[0];
        if (!objectName) {
          throw new Error('TopoJSON missing layer object');
        }
        const shapes = feature(
          topo,
          topo.objects[objectName] as Parameters<typeof feature>[1]
        ) as FeatureCollection;

        setFeatureCollection(shapes);
        setLoadState({ type: 'ready' });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Unknown error loading district shapes';
        // eslint-disable-next-line no-console
        console.error(error);
        setLoadState({ type: 'error', message });
      }
    };

    loadData();

    return () => {
      abortController.abort();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !featureCollection) {
      return;
    }

    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.remove();
      geoJsonLayerRef.current = null;
    }

    geoJsonLayerRef.current = L.geoJSON(featureCollection as unknown as any, {
      style: (featureArg: Feature) => styleFeature(featureArg as DistrictFeature, votes),
      onEachFeature: (featureArg: Feature, layer) => {
        const districtValue = (featureArg as DistrictFeature).properties?.CounDist ?? null;
        const tooltipHtml = buildTooltipHtml(districtValue, votes, districtDetails, action);
        layer.bindTooltip(tooltipHtml, {
          direction: 'auto',
          sticky: true,
          className: 'district-tooltip'
        });
      }
    }) as LeafletGeoJSON<DistrictFeature>;

    geoJsonLayerRef.current.addTo(map);

    const bounds = geoJsonLayerRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([40.7128, -74.006], 11);
    }
  }, [featureCollection, votes, districtDetails, action]);

  return <div ref={containerRef} className="map-container" role="presentation" />;
};

export default LeafletMap;
