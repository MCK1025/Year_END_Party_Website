import symbol from "../../assets/brand/invitation-symbol.png";

export function BookOpening() {
  return (
    <div aria-hidden="true" className="album-hardback">
      <div className="album-back-cover" />
      <div className="album-paper-block" />
      <div className="album-spine" />
      <div className="album-leaf leaf-three" />
      <div className="album-leaf leaf-two" />
      <div className="album-leaf leaf-one" />
      <div className="album-front-cover">
        <div className="album-foil">
          <img src={symbol} alt="" width="72" height="42" />
          <span>2026</span>
          <strong>1년의 장면들</strong>
        </div>
      </div>
    </div>
  );
}
