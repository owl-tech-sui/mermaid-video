import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import mermaid from "mermaid";

// Schema for props validation
export const mermaidSchema = z.object({
  diagram: z.string(),
  backgroundColor: z.string().optional(),
});

type MermaidDiagramProps = z.infer<typeof mermaidSchema>;

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  diagram,
  backgroundColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [svgContent, setSvgContent] = useState<string>("");

  // Render mermaid diagram on mount
  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram);
        setSvgContent(svg);
      } catch (error) {
        console.error("Mermaid render error:", error);
        setSvgContent(`<svg><text x="50" y="50" fill="red">Error rendering diagram</text></svg>`);
      }
    };
    renderDiagram();
  }, [diagram]);

  // Animation: fade in + scale
  const fadeIn = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
  });

  const scale = interpolate(fadeIn, [0, 1], [0.8, 1]);

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Fade out near the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity: opacity * fadeOut,
          width: "80%",
          height: "80%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </AbsoluteFill>
  );
};
