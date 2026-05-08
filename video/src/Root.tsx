import "./index.css";
import { Composition } from "remotion";
import {
  HavenHeroComposition,
  HavenHeroPreviewComposition,
} from "./Composition";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HavenHero"
        component={HavenHeroComposition}
        durationInFrames={240}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="HavenHeroPreview"
        component={HavenHeroPreviewComposition}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
