import { HttpError, identity, rpc, serve } from "../_shared/http.ts";

serve(async (request) => {
  const { client, user, aal } = await identity(request);
  await rpc(client, user.id, "dashboard", {}, aal);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 8388608)
    throw new HttpError(400, "8MB 이하의 사진을 선택해주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!png && !jpeg && !webp) throw new HttpError(400, "JPG, PNG, WebP 사진만 사용할 수 있습니다.");
  const type = png ? "image/png" : jpeg ? "image/jpeg" : "image/webp";
  const path = `${crypto.randomUUID()}.${png ? "png" : jpeg ? "jpg" : "webp"}`;
  const { error } = await client.storage
    .from("event-media")
    .upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new HttpError(500, "사진 업로드에 실패했습니다.");
  return { path };
});
