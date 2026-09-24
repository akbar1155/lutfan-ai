import { useTranslation } from "react-i18next";
import { PaymeIcon, ClickIcon } from "./PaymentIcons";

export type PaymentMethod = "payme" | "click";

type PaymentMethodModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
  amount: number;
};

export default function PaymentMethodModal({
  isOpen,
  onClose,
  onSelect,
  amount,
}: PaymentMethodModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payment-method-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t("close")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <h2 className="payment-method-title">{t("selectPaymentMethod")}</h2>
        <p className="payment-method-amount">
          {t("amount")}: <strong>{amount.toLocaleString("ru-RU")} {t("currency")}</strong>
        </p>

        <div className="payment-methods-grid">
          <button
            type="button"
            className="payment-method-card"
            onClick={() => handleSelect("payme")}
          >
            <div className="payment-method-icon">
              <PaymeIcon />
            </div>
            <div className="payment-method-info">
              <h3>Payme</h3>
              <p>{t("paymeDescription")}</p>
            </div>
            <div className="payment-method-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          <button
            type="button"
            className="payment-method-card"
            onClick={() => handleSelect("click")}
          >
            <div className="payment-method-icon">
              <ClickIcon />
            </div>
            <div className="payment-method-info">
              <h3>Click</h3>
              <p>{t("clickDescription")}</p>
            </div>
            <div className="payment-method-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
