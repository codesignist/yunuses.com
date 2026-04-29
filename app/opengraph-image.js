import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const alt = "Yunus Eş — codesignist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const avatarBuffer = fs.readFileSync(
    path.join(process.cwd(), "public", "avatar.webp"),
  );
  const avatarSrc = `data:image/webp;base64,${avatarBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <img
          src={avatarSrc}
          width={220}
          height={220}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Yunus Eş
          </div>
          <div
            style={{
              fontSize: 44,
              color: "#a1a1a1",
              marginTop: 16,
              letterSpacing: "-0.01em",
            }}
          >
            codesignist
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
