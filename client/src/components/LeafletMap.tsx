import { useEffect, useRef, useState } from 'react';
import L, { type GeoJSON as LeafletGeoJSON } from 'leaflet';
import { feature } from 'topojson-client';
import type { FeatureCollection, Feature } from 'geojson';
import type { Topology } from 'topojson-specification';
import type { VoteStatus } from '../types';

type LoadState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'error'; message: string };

type LeafletMapProps = {
  votes: Record<string, VoteStatus>;
  onStatusChange?: (state: LoadState) => void;
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

export const LeafletMap = ({ votes, onStatusChange }: LeafletMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<LeafletGeoJSON<DistrictFeature> | null>(null);

  const [featureCollection, setFeatureCollection] = useState<FeatureCollection | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ type: 'idle' });

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
        attributionControl: false
      });
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

    geoJsonLayerRef.current = L.geoJSON<DistrictFeature>(featureCollection as any, {
      style: (featureArg) => styleFeature(featureArg as DistrictFeature, votes)
    }).addTo(map);

    const bounds = geoJsonLayerRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([40.7128, -74.006], 11);
    }
  }, [featureCollection, votes]);

  return <div ref={containerRef} className="map-container" role="presentation" />;
};

export default LeafletMap;
