import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Freeze,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  ink: "#2c3630",
  inkMid: "#4a5c54",
  inkLight: "#7a8e86",
  sage: "#8ba89a",
  sageMid: "#b8cec6",
  sageLight: "#e8f0ed",
  sky: "#aecad8",
  skyMid: "#c8dce8",
  skyLight: "#eaf4f8",
  skyInk: "#3a6e84",
  blush: "#e8c4b4",
  blushLight: "#faf0eb",
  blushInk: "#8c4c35",
  sand: "#f4efe8",
  cream: "#fdfaf6",
  white: "#ffffff",
};

const backgroundImage = staticFile("hero-banner.png");

const surfaceShadow = "0 28px 90px rgba(44, 54, 48, 0.16)";
const cardShadow = "0 20px 48px rgba(44, 54, 48, 0.12)";

const titleStyle: CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontSize: 72,
  lineHeight: 1,
  letterSpacing: -1.8,
  color: colors.ink,
  margin: 0,
  maxWidth: 520,
};

const bodyStyle: CSSProperties = {
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 22,
  lineHeight: 1.45,
  color: colors.inkMid,
  margin: 0,
  maxWidth: 520,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  alignSelf: "flex-start",
  borderRadius: 999,
  padding: "10px 18px",
  border: `1px solid ${colors.skyMid}`,
  backgroundColor: colors.skyLight,
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: colors.skyInk,
};

const glassCard = (backgroundColor: string): CSSProperties => ({
  position: "absolute",
  borderRadius: 30,
  border: "1px solid rgba(255, 255, 255, 0.55)",
  background: backgroundColor,
  boxShadow: cardShadow,
  backdropFilter: "blur(24px)",
});

const labelStyle: CSSProperties = {
  margin: 0,
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: colors.inkMid,
};

const cardTitleStyle: CSSProperties = {
  margin: "8px 0 0 0",
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 24,
  fontWeight: 700,
  color: colors.ink,
};

const cardBodyStyle: CSSProperties = {
  margin: "10px 0 0 0",
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 16,
  lineHeight: 1.4,
  color: colors.inkMid,
};

const dot = (backgroundColor: string): CSSProperties => ({
  width: 11,
  height: 11,
  borderRadius: 999,
  backgroundColor,
  boxShadow: "0 0 0 7px rgba(255,255,255,0.72)",
  flexShrink: 0,
});

const getRise = (frame: number, fps: number, delay: number) => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {
      damping: 18,
      stiffness: 110,
      mass: 0.9,
    },
  });

  return {
    progress,
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [36, 0]),
    scale: interpolate(progress, [0, 1], [0.96, 1]),
  };
};

const getLoopSway = (
  frame: number,
  durationInFrames: number,
  amplitude: number,
  phase = 0,
) => {
  return Math.sin((frame / durationInFrames) * Math.PI * 2 + phase) * amplitude;
};

const TimelineCard = ({ frame }: { frame: number }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const rise = getRise(frame, fps, 18);
  const swayX = getLoopSway(frame, durationInFrames, 10, 0.4);
  const swayY = getLoopSway(frame, durationInFrames, 8, 1.6);

  return (
    <div
      style={{
        ...glassCard("rgba(255,255,255,0.9)"),
        left: 610,
        top: 92,
        width: 350,
        padding: 24,
        opacity: rise.opacity,
        transform: `translate(${swayX}px, ${rise.translateY + swayY}px) scale(${rise.scale})`,
      }}
    >
      <p style={labelStyle}>Your timeline</p>
      <p style={cardTitleStyle}>H-1B transfer in progress</p>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {[
          ["Receipt notice expected", "Apr 22", colors.sage],
          ["Travel decision window", "May 03", colors.skyInk],
          ["Premium processing latest safe date", "May 16", colors.blushInk],
        ].map(([label, date, tone], index) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 14,
              paddingBottom: index === 2 ? 0 : 14,
              borderBottom:
                index === 2 ? "none" : "1px solid rgba(74, 92, 84, 0.12)",
            }}
          >
            <div style={dot(tone)} />
            <div>
              <p
                style={{
                  margin: 0,
                  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: colors.ink,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                  fontSize: 13,
                  color: colors.inkLight,
                }}
              >
                Deterministic where possible, honest where not.
              </p>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                fontSize: 14,
                fontWeight: 700,
                color: tone,
              }}
            >
              {date}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const CrisisCard = ({ frame }: { frame: number }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const rise = getRise(frame, fps, 34);
  const swayX = getLoopSway(frame, durationInFrames, 8, 1.2);
  const swayY = getLoopSway(frame, durationInFrames, 10, 2.2);

  return (
    <div
      style={{
        ...glassCard("rgba(250,240,235,0.92)"),
        right: 70,
        top: 388,
        width: 316,
        padding: 24,
        opacity: rise.opacity,
        transform: `translate(${swayX}px, ${rise.translateY + swayY}px) scale(${rise.scale})`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          backgroundColor: colors.white,
          border: `1px solid rgba(140, 76, 53, 0.16)`,
        }}
      >
        <span
          style={{
            ...dot(colors.blushInk),
            width: 8,
            height: 8,
            boxShadow: "none",
          }}
        />
        <span
          style={{
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: colors.blushInk,
          }}
        >
          Layoff plan
        </span>
      </div>
      <p style={{ ...cardTitleStyle, marginTop: 16 }}>
        One calm action at a time
      </p>
      <p style={cardBodyStyle}>
        Grace period, employer transfer, travel risk, and backup options pulled
        into a single next-step view.
      </p>
      <div
        style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        {["60-day checklist", "Employer change", "Travel risk"].map(
          (item, index) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                backgroundColor:
                  index === 0 ? colors.white : "rgba(255,255,255,0.56)",
                border: "1px solid rgba(140, 76, 53, 0.12)",
                fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: index === 0 ? colors.blushInk : colors.inkMid,
              }}
            >
              {item}
            </span>
          ),
        )}
      </div>
    </div>
  );
};

const CommunityCard = ({ frame }: { frame: number }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const rise = getRise(frame, fps, 50);
  const swayX = getLoopSway(frame, durationInFrames, 12, 2.6);
  const swayY = getLoopSway(frame, durationInFrames, 8, 3.1);

  return (
    <div
      style={{
        ...glassCard("rgba(234,244,248,0.94)"),
        left: 718,
        top: 508,
        width: 454,
        padding: 22,
        opacity: rise.opacity,
        transform: `translate(${swayX}px, ${rise.translateY + swayY}px) scale(${rise.scale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <p style={{ ...labelStyle, color: colors.skyInk }}>
            Matched community
          </p>
          <p style={{ ...cardTitleStyle, marginTop: 6, fontSize: 22 }}>
            Stories from your queue and stage
          </p>
        </div>
        <div style={{ display: "flex", marginLeft: 16 }}>
          {["P", "M", "R"].map((initial, index) => (
            <div
              key={initial}
              style={{
                width: 40,
                height: 40,
                marginLeft: index === 0 ? 0 : -8,
                borderRadius: 999,
                border: `2px solid ${colors.white}`,
                backgroundColor:
                  index === 0
                    ? colors.sky
                    : index === 1
                      ? colors.sageMid
                      : colors.blush,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                fontSize: 14,
                fontWeight: 700,
                color: colors.ink,
              }}
            >
              {initial}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.72)",
          border: `1px solid rgba(58, 110, 132, 0.12)`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: 15,
            fontWeight: 700,
            color: colors.ink,
          }}
        >
          H-1B transfer after layoff
        </p>
        <p
          style={{
            margin: "4px 0 0 0",
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: colors.skyInk,
          }}
        >
          India queue · day 21
        </p>
        <p style={{ ...cardBodyStyle, marginTop: 8, fontSize: 15 }}>
          Haven surfaces what people actually did, not just generic warnings.
        </p>
      </div>
    </div>
  );
};

const BrandLockup = ({ frame }: { frame: number }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const rise = getRise(frame, fps, 0);
  const loopYOffset = getLoopSway(frame, durationInFrames, 4, 0.7);

  return (
    <div
      style={{
        position: "absolute",
        left: 74,
        top: 88,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        opacity: rise.opacity,
        transform: `translateY(${rise.translateY + loopYOffset}px) scale(${rise.scale})`,
      }}
    >
      <div style={pillStyle}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: colors.skyInk,
            display: "inline-block",
          }}
        />
        Built for U.S. immigration
      </div>

      <div>
        <p
          style={{
            margin: 0,
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 54,
            lineHeight: 0.9,
            letterSpacing: -1.2,
          }}
        >
          <span style={{ color: colors.ink }}>Ha</span>
          <span style={{ color: colors.sage }}>ven</span>
        </p>
        <h1 style={{ ...titleStyle, marginTop: 18 }}>
          You don&apos;t have to navigate immigration{" "}
          <span style={{ color: colors.sage }}>alone</span>.
        </h1>
        <p style={{ ...bodyStyle, marginTop: 20 }}>
          Calm timelines, layoff planning, and matched guidance for people
          moving through the same visa path.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {["Personal timelines", "Layoff planning", "Matched community"].map(
          (item, index) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                padding: "10px 16px",
                backgroundColor:
                  index === 1 ? colors.white : "rgba(255,255,255,0.72)",
                border: `1px solid ${index === 1 ? "rgba(232, 196, 180, 0.48)" : "rgba(139, 168, 154, 0.24)"}`,
                fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                fontSize: 14,
                fontWeight: 600,
                color: index === 1 ? colors.blushInk : colors.inkMid,
              }}
            >
              {item}
            </span>
          ),
        )}
      </div>
    </div>
  );
};

export const HavenHeroComposition = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const panX = getLoopSway(frame, durationInFrames, 22, 0.6);
  const panY = getLoopSway(frame, durationInFrames, 12, 2.4);
  const zoom = 1.08 + getLoopSway(frame, durationInFrames, 0.015, 0.9);
  const glowShift = getLoopSway(frame, durationInFrames, 26, 0.2);
  const stripeShift = getLoopSway(frame, durationInFrames, 18, 1.9);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.95) 0%, rgba(253,250,246,0.82) 32%, rgba(253,250,246,0.18) 68%, rgba(253,250,246,0) 100%)",
        }}
      />

      <Img
        src={backgroundImage}
        style={{
          position: "absolute",
          inset: -48,
          width: 1376,
          height: 816,
          objectFit: "cover",
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          filter: "saturate(0.88) contrast(0.95) brightness(1.02)",
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(253,250,246,0.96) 0%, rgba(253,250,246,0.78) 34%, rgba(253,250,246,0.34) 58%, rgba(253,250,246,0.64) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 142 + glowShift,
          top: 64,
          width: 290,
          height: 290,
          borderRadius: 60,
          background: "rgba(174, 202, 216, 0.26)",
          boxShadow: surfaceShadow,
          transform: "rotate(9deg)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 628 + stripeShift,
          bottom: -34,
          width: 420,
          height: 240,
          borderRadius: 56,
          background:
            "repeating-linear-gradient(180deg, rgba(232,196,180,0.28) 0 18px, rgba(255,255,255,0.08) 18px 38px)",
          opacity: 0.9,
          transform: "rotate(-12deg)",
        }}
      />

      <Sequence>
        <BrandLockup frame={frame} />
      </Sequence>
      <Sequence from={12}>
        <TimelineCard frame={frame} />
      </Sequence>
      <Sequence from={22}>
        <CrisisCard frame={frame} />
      </Sequence>
      <Sequence from={34}>
        <CommunityCard frame={frame} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const HavenHeroPreviewComposition = () => {
  return (
    <Freeze frame={90}>
      <HavenHeroComposition />
    </Freeze>
  );
};
