import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Hy_stepper — Stay Sleek in Style';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#0f0800',
        }}
      >
        {/* Radial glow — bottom centre */}
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(220,149,39,0.22) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Ring — top right */}
        <div
          style={{
            position: 'absolute',
            top: '-160px',
            right: '-160px',
            width: '440px',
            height: '440px',
            borderRadius: '50%',
            border: '2px solid rgba(220,149,39,0.18)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            border: '1px solid rgba(220,149,39,0.10)',
            display: 'flex',
          }}
        />

        {/* Ring — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-180px',
            left: '-180px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            border: '1px solid rgba(220,149,39,0.12)',
            display: 'flex',
          }}
        />

        {/* Top rule */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '80px',
            right: '80px',
            height: '1px',
            background:
              'linear-gradient(to right, transparent 0%, rgba(220,149,39,0.45) 50%, transparent 100%)',
            display: 'flex',
          }}
        />
        {/* Bottom rule */}
        <div
          style={{
            position: 'absolute',
            bottom: '52px',
            left: '80px',
            right: '80px',
            height: '1px',
            background:
              'linear-gradient(to right, transparent 0%, rgba(220,149,39,0.45) 50%, transparent 100%)',
            display: 'flex',
          }}
        />

        {/* ── Main centred content ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: '0px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '1px',
                background: 'rgba(220,149,39,0.55)',
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: '15px',
                fontWeight: 500,
                letterSpacing: '5px',
                textTransform: 'uppercase',
                color: 'rgba(220,149,39,0.75)',
                display: 'flex',
              }}
            >
              Premium Footwear · Ghana
            </div>
            <div
              style={{
                width: '40px',
                height: '1px',
                background: 'rgba(220,149,39,0.55)',
                display: 'flex',
              }}
            />
          </div>

          {/* Brand name — split into spans to avoid mixed text/element children */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'baseline',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontSize: '108px',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-4px',
              }}
            >
              Hy
            </span>
            <span
              style={{
                fontSize: '108px',
                fontWeight: 800,
                color: '#dc9527',
                letterSpacing: '-4px',
              }}
            >
              _
            </span>
            <span
              style={{
                fontSize: '108px',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-4px',
              }}
            >
              stepper
            </span>
          </div>

          {/* Gold divider */}
          <div
            style={{
              width: '80px',
              height: '4px',
              background: 'linear-gradient(to right, #b8721e, #dc9527, #f0b84a)',
              borderRadius: '2px',
              marginTop: '24px',
              marginBottom: '28px',
              display: 'flex',
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: '28px',
              color: 'rgba(255,255,255,0.70)',
              letterSpacing: '8px',
              textTransform: 'uppercase',
              fontWeight: 300,
              display: 'flex',
            }}
          >
            Stay Sleek in Style
          </div>
        </div>

        {/* Domain footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '15px',
              color: 'rgba(220,149,39,0.45)',
              letterSpacing: '3px',
              display: 'flex',
            }}
          >
            hystepper.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
