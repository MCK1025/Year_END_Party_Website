import symbol from "../../assets/brand/invitation-symbol.png";

export function InvitationFallback() {
  return (
    <div className="invite-envelope-static" aria-hidden="true">
      <div className="invite-envelope-flap">
        <img className="envelope-seal" src={symbol} width={288} height={167} alt="" />
      </div>
    </div>
  );
}
