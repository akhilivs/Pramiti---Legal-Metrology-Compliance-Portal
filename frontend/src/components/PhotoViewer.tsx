'use client';
import { useState } from 'react';
import type { Region } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Icon, Thumb } from './ui';

export const FIELD_LABELS: Record<string, string> = {
  mrp: 'MRP',
  net_quantity: 'Net quantity',
  manufacturer: 'Manufacturer / Packer',
  date: 'Mfg / Pkd date',
  best_before: 'Best before',
  consumer_care: 'Consumer care',
  unit_sale_price: 'Unit sale price',
  generic_name: 'Generic name',
  country_of_origin: 'Country of origin',
};

/** Which label region a check refers to (for hover-highlighting). */
export const CHECK_FIELD: Record<string, string> = {
  manufacturer: 'manufacturer',
  generic_name: 'generic_name',
  net_quantity: 'net_quantity',
  date: 'date',
  mrp: 'mrp',
  mrp_integrity: 'mrp',
  unit_sale_price: 'unit_sale_price',
  price_arithmetic: 'unit_sale_price',
  consumer_care: 'consumer_care',
  best_before: 'best_before',
  country_of_origin: 'country_of_origin',
  pdp_legibility: 'net_quantity',
  font_size: 'net_quantity',
  quantity_verification: 'net_quantity',
};

/**
 * Package photos with the AI's bounding boxes drawn over each declaration it read,
 * so officers can see the evidence behind every finding.
 */
export default function PhotoViewer({
  images,
  regions,
  focus,
  failedFields = [],
  height = 'max-h-[26rem]',
}: {
  images: string[];
  regions: Region[];
  focus?: string | null;
  failedFields?: string[];
  height?: string;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(true);
  const focusIndex = focus ? regions.find((r) => r.field === focus)?.image_index : undefined;
  const current = focusIndex !== undefined && focusIndex < images.length ? focusIndex : Math.min(index, images.length - 1);
  const boxes = regions.filter((r) => r.image_index === current);

  if (!images.length) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sand-strong bg-parchment/40 text-sm text-muted">
        <Icon name="globe" className="h-6 w-6" />
        Listing checked from page text - no images
      </div>
    );
  }

  return (
    <div>
      <div className="relative flex justify-center overflow-hidden rounded-xl bg-[#1d1a16] p-2">
        <div className="relative inline-block">
          {/* Deliberately the original file, not a resized copy: officers zoom in to read fine label print,
              and the region boxes are laid over the photo's own dimensions */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[current]}
            alt={`Package photograph ${current + 1}`}
            fetchPriority="high"
            className={`block h-auto w-auto max-w-full ${height}`}
          />
          {show &&
            boxes.map((r, i) => {
              const [y0, x0, y1, x1] = r.box;
              const active = focus === r.field;
              const bad = failedFields.includes(r.field);
              return (
                <div
                  key={`${r.field}-${i}`}
                  className={`pointer-events-none absolute rounded-[3px] border-2 transition-all duration-200 ${
                    active
                      ? 'z-10 border-saffron bg-saffron/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
                      : bad
                        ? 'border-[#e0645c] bg-[#e0645c]/10'
                        : 'border-[#6fd3a0] bg-[#6fd3a0]/10'
                  }`}
                  style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }}
                >
                  {(active || (!focus && boxes.length <= 3)) && (
                    <span
                      className={`absolute -top-[1.15rem] left-[-2px] whitespace-nowrap rounded-t px-1 text-[10px] font-semibold leading-[1.1rem] text-white ${
                        active ? 'bg-saffron' : bad ? 'bg-[#c2453d]' : 'bg-[#1f7a4f]'
                      }`}
                    >
                      {t(FIELD_LABELS[r.field] ?? r.field)}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {images.length > 1 &&
          images.map((url, i) => (
            <button
              key={url}
              onClick={() => setIndex(i)}
              className={`h-12 w-12 overflow-hidden rounded-md border-2 ${i === current ? 'border-saffron' : 'border-sand'}`}
            >
              <Thumb src={url} size={48} alt={`Photo ${i + 1}`} className="h-full w-full" />
            </button>
          ))}
        {regions.length > 0 && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-soft">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-[var(--indigo)]" />
            <Icon name="eye" className="h-4 w-4" /> {t('Show highlights')}
          </label>
        )}
      </div>
    </div>
  );
}
