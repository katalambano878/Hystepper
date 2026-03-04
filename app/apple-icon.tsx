import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #1a0a00, #3d1c0b)',
          borderRadius: '36px',
        }}
      >
        <span
          style={{
            fontSize: '96px',
            fontWeight: 800,
            color: '#dc9527',
            letterSpacing: '-4px',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  );
}
