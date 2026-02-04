import { Composition } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";
import { MermaidDiagram, mermaidSchema } from "./MermaidDiagram/MermaidDiagram";
import { MermaidAnimated, mermaidAnimatedSchema } from "./MermaidDiagram/MermaidAnimated";
import {
  branchingFlowchart,
  sequenceDiagram,
  pieChart,
  stateDiagram,
  mindmap,
} from "./MermaidDiagram/diagrams";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      />

      {/* Mermaid Diagram with animation */}
      <Composition
        id="MermaidDiagram"
        component={MermaidDiagram}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidSchema}
        defaultProps={{
          diagram: `flowchart TD
    A[Claude Code] -->|解析| B[コードベース]
    B --> C{理解}
    C -->|図解| D[Mermaid]
    D -->|動画化| E[Remotion]
    E --> F[MP4出力]`,
          backgroundColor: "#f0f4f8",
        }}
      />

      {/* Mermaid Animated - 部品ごとにアニメーション */}
      <Composition
        id="MermaidAnimated"
        component={MermaidAnimated}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: `flowchart TD
    A[Claude Code] -->|解析| B[コードベース]
    B --> C{理解}
    C -->|図解| D[Mermaid]
    D -->|動画化| E[Remotion]
    E --> F[MP4出力]`,
          backgroundColor: "#1a1a2e",
          framesPerElement: 25,
        }}
      />

      {/* 検証用: 分岐フローチャート */}
      <Composition
        id="BranchingFlow"
        component={MermaidAnimated}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: branchingFlowchart,
          backgroundColor: "#1a1a2e",
          framesPerElement: 20,
        }}
      />

      {/* 検証用: シーケンス図 */}
      <Composition
        id="SequenceDiagram"
        component={MermaidAnimated}
        durationInFrames={400}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: sequenceDiagram,
          backgroundColor: "#1a1a2e",
          framesPerElement: 20,
        }}
      />

      {/* 検証用: パイチャート */}
      <Composition
        id="PieChart"
        component={MermaidAnimated}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: pieChart,
          backgroundColor: "#1a1a2e",
          framesPerElement: 30,
        }}
      />

      {/* 検証用: 状態遷移図 */}
      <Composition
        id="StateDiagram"
        component={MermaidAnimated}
        durationInFrames={400}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: stateDiagram,
          backgroundColor: "#1a1a2e",
          framesPerElement: 20,
        }}
      />

      {/* 検証用: マインドマップ */}
      <Composition
        id="Mindmap"
        component={MermaidAnimated}
        durationInFrames={500}
        fps={30}
        width={1920}
        height={1080}
        schema={mermaidAnimatedSchema}
        defaultProps={{
          diagram: mindmap,
          backgroundColor: "#1a1a2e",
          framesPerElement: 15,
        }}
      />
    </>
  );
};
