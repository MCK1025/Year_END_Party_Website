import wordmark from "../assets/brand/hyeseong-foods.png";
import { PrivateImage } from "./PrivateImage";

export function CompanyLogo({ path }: { readonly path?: string | null }) {
  return path ? (
    <PrivateImage path={path} alt="회사 로고" logo />
  ) : (
    <img className="hyeseong-wordmark" src={wordmark} width={640} height={118} alt="주식회사 혜성식품" />
  );
}
