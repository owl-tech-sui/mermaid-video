#!/usr/bin/env node
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { Command } from "commander";

const program = new Command();

program
  .name("mermaid-video")
  .description("Convert Mermaid diagrams to animated videos")
  .version("0.1.0")
  .argument("<input>", "Mermaid diagram file (.mmd or .md)")
  .option("-o, --output <file>", "Output video file", "output.mp4")
  .option("--fps <number>", "Frames per second", "30")
  .option("--width <number>", "Video width", "1920")
  .option("--height <number>", "Video height", "1080")
  .option("--background <color>", "Background color", "#1a1a2e")
  .option("--speed <number>", "Frames per element (lower = faster)", "20")
  .option("--duration <number>", "Duration in seconds (auto-calculated if not set)")
  .action(async (input: string, options) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    // Read the Mermaid diagram
    let diagram = readFileSync(inputPath, "utf-8");

    // If it's a markdown file, extract mermaid code block
    if (inputPath.endsWith(".md")) {
      const match = diagram.match(/```mermaid\n([\s\S]*?)\n```/);
      if (match) {
        diagram = match[1];
      } else {
        console.error("Error: No mermaid code block found in markdown file");
        process.exit(1);
      }
    }

    console.log("📊 Mermaid Video Generator");
    console.log("========================");
    console.log(`Input: ${basename(inputPath)}`);
    console.log(`Output: ${options.output}`);
    console.log(`Resolution: ${options.width}x${options.height}`);
    console.log(`FPS: ${options.fps}`);
    console.log(`Speed: ${options.speed} frames/element`);
    console.log("");

    // Detect diagram type for duration calculation
    const diagramType = detectDiagramType(diagram);
    const elementCount = estimateElementCount(diagram, diagramType);
    const framesPerElement = parseInt(options.speed);
    const fps = parseInt(options.fps);

    // Calculate duration
    let durationInFrames: number;
    if (options.duration) {
      durationInFrames = parseInt(options.duration) * fps;
    } else {
      // Auto-calculate: elements * framesPerElement + buffer
      durationInFrames = elementCount * framesPerElement + fps * 2; // 2 second buffer
    }

    console.log(`Diagram type: ${diagramType}`);
    console.log(`Estimated elements: ${elementCount}`);
    console.log(`Duration: ${(durationInFrames / fps).toFixed(1)}s (${durationInFrames} frames)`);
    console.log("");

    // Prepare props for Remotion
    const props = JSON.stringify({
      diagram,
      backgroundColor: options.background,
      framesPerElement,
    });

    // Build the remotion render command
    const renderCommand = [
      "npx remotion render",
      "MermaidAnimated",
      `"${options.output}"`,
      `--props='${props}'`,
      `--width=${options.width}`,
      `--height=${options.height}`,
      `--fps=${options.fps}`,
      `--frames=0-${durationInFrames - 1}`,
    ].join(" ");

    console.log("🎬 Rendering...");
    console.log("");

    try {
      execSync(renderCommand, {
        stdio: "inherit",
        cwd: resolve(__dirname, ".."),
      });
      console.log("");
      console.log(`✅ Video saved to: ${options.output}`);
    } catch (error) {
      console.error("❌ Render failed");
      process.exit(1);
    }
  });

function detectDiagramType(diagram: string): string {
  const trimmed = diagram.trim().toLowerCase();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) return "flowchart";
  if (trimmed.startsWith("sequencediagram")) return "sequence";
  if (trimmed.startsWith("pie")) return "pie";
  if (trimmed.startsWith("statediagram")) return "state";
  if (trimmed.startsWith("mindmap")) return "mindmap";
  if (trimmed.startsWith("classdiagram")) return "class";
  if (trimmed.startsWith("erdiagram")) return "er";
  if (trimmed.startsWith("gantt")) return "gantt";
  return "unknown";
}

function estimateElementCount(diagram: string, type: string): number {
  const lines = diagram.split("\n").filter((l) => l.trim());

  switch (type) {
    case "flowchart": {
      // Count nodes and edges
      const nodeMatches = diagram.match(/\w+\[/g) || [];
      const edgeMatches = diagram.match(/-->/g) || [];
      return nodeMatches.length + edgeMatches.length;
    }
    case "sequence": {
      // Count participants and messages
      const participants = (diagram.match(/participant/gi) || []).length;
      const messages = (diagram.match(/->|-->/g) || []).length;
      return participants + messages;
    }
    case "pie": {
      // Count title + segments
      const segments = (diagram.match(/".+"\s*:/g) || []).length;
      return 1 + segments; // title + segments
    }
    case "state": {
      // Count states and transitions
      const states = new Set<string>();
      lines.forEach((line) => {
        const match = line.match(/(\w+)\s*-->/);
        if (match) states.add(match[1]);
        const match2 = line.match(/-->\s*(\w+)/);
        if (match2) states.add(match2[1]);
      });
      const transitions = (diagram.match(/-->/g) || []).length;
      return states.size + transitions;
    }
    case "mindmap": {
      // Count all non-empty, non-directive lines
      return lines.filter((l) => !l.trim().toLowerCase().startsWith("mindmap")).length;
    }
    default:
      return lines.length;
  }
}

program.parse();
