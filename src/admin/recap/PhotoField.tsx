import type { CSSProperties } from "react";
import { useState } from "react";
import { AlbumPhoto } from "../../components/recap/AlbumPhoto";
import { Button, Field, Select } from "../../components/ui";
import { upload } from "../../lib/api";

export function PhotoField({
  label,
  path,
  change,
  library,
  run,
  style,
}: {
  readonly label: string;
  readonly path: string | null;
  readonly change: (path: string | null) => void;
  readonly library: ReadonlyMap<string, string>;
  readonly run: (work: () => Promise<void>, notice?: string) => Promise<void>;
  readonly style?: CSSProperties;
}) {
  const [showLibrary, setShowLibrary] = useState(false);
  return (
    <div className="stack-sm">
      {path && (
        <div className="recap-admin-photo">
          <AlbumPhoto
            key={path}
            path={path}
            alt={`${label} 미리보기`}
            style={style ?? { objectFit: "contain" }}
          />
        </div>
      )}
      <Field
        type="file"
        label={`${label} 업로드`}
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file)
            void run(async () => change(await upload(file)), "사진을 준비했습니다. Moment를 저장해주세요.");
        }}
      />
      <div className="actions">
        {library.size > 0 && (
          <Button variant="secondary" onClick={() => setShowLibrary(!showLibrary)}>
            등록된 사진 선택
          </Button>
        )}
        {path && (
          <Button variant="secondary" onClick={() => change(null)}>
            사진 제거
          </Button>
        )}
      </div>
      {showLibrary && (
        <Select
          label={`${label} 선택`}
          value={path ?? ""}
          onChange={(v) => {
            if (v) change(v);
            setShowLibrary(false);
          }}
        >
          <option value="">사진 선택</option>
          {[...library].map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
