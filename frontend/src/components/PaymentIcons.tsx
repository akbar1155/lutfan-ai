// Import real payment app logos from assets
import PaymeIconSvg from "../assets/payment-img/payme.tsx";
import ClickUzIconSvg from "../assets/payment-img/clickuzIcon.tsx";
import PaynetIconSvg from "../assets/payment-img/paynetIcon.tsx";
import UzumBankImage from "../assets/payment-img/UZUM_BANK-01.png";
import XaznaImage from "../assets/payment-img/XAZNA.png";

export function PaymeIcon() {
  return <PaymeIconSvg />;
}

export function ClickIcon() {
  return <ClickUzIconSvg />;
}

export function PaynetIcon() {
  return <PaynetIconSvg />;
}

export function UzumIcon() {
  return <img src={UzumBankImage} alt="Uzum Bank" style={{ width: "100%", height: "100%" }} />;
}

export function XaznaIcon() {
  return <img src={XaznaImage} alt="Xazna" style={{ width: "100%", height: "100%" }} />;
}
