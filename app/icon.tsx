import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0800',
          borderRadius: '4px',
        }}
      >
        <span
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#dc9527',
            letterSpacing: '-1px',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  );
}
