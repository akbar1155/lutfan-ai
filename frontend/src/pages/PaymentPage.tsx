
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PAYMENT_APPS, PAYMENT_CARD_NUMBER } from "../constants/paymentApps";
import { PaymeIcon, ClickIcon, PaynetIcon, UzumIcon, XaznaIcon } from "../components/PaymentIcons";

type PaymentStatus = "idle" | "submitting" | "pending" | "error";

type PaymentCheckStatus = "checking" | "paid" | "unpaid";

export default function PaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationId = searchParams.get("invitation");
  const [autoCheckFailed, setAutoCheckFailed] = useState(false);
  const [paymentCheckStatus, setPaymentCheckStatus] = useState<PaymentCheckStatus>("checking");

  // Payme redirected the user back here after checkout (see the `c=` return
  // URL built in payments/services.py::build_checkout_link). Poll the
  // invitation until PerformTransaction has landed, then show success UI.
  useEffect(() => {
    if (!invitationId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const info = await api.getPaymentInfo(invitationId);
        if (cancelled) return;
        if (info.is_paid) {
          setPaymentCheckStatus("paid");
          return;
        }
        setPaymentCheckStatus("unpaid");
        timer = window.setTimeout(poll, 3000);
      } catch {
        if (!cancelled) {
          setAutoCheckFailed(true);
          setPaymentCheckStatus("unpaid");
          timer = window.setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [invitationId]);

  const handleContinue = () => {
    if (!invitationId) return;
    navigate(`/create/${invitationId}/generating`, {
      replace: true,
      state: { pendingGenerate: true },
    });
  };

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentInfo, setPaymentInfo] = useState<{
    amount_uzs: number;
    checkout_url: string;
  } | null>(null);

  // Fetch payment info when not in return/polling mode
  useEffect(() => {
    if (invitationId) return; // Skip if in polling mode

    const fetchPaymentInfo = async () => {
      try {
        // In real scenario, get invitation ID from context or URL params
        // For now, this page is mainly used for Payme return polling
        const info = await api.getPaymentInfo("placeholder-id");
        setPaymentInfo(info);
      } catch (err) {
        console.error("Failed to fetch payment info:", err);
      }
    };
    void fetchPaymentInfo();
  }, [invitationId]);

  const paymentAmount = paymentInfo?.amount_uzs.toLocaleString("ru-RU") || "11 900";

  const handleCopyCardNumber = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_CARD_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(t("paymentReceiptInvalidType"));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t("paymentReceiptTooLarge"));
      return;
    }

    setError("");
    setReceiptFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setPreviewUrl(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!receiptFile) {
      setError(t("paymentReceiptRequired"));
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      // TODO: Implement actual API call to submit receipt
      // const formData = new FormData();
      // formData.append("receipt", receiptFile);
      // await api.submitPaymentReceipt(formData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("paymentSubmitFailed"));
      setStatus("error");
    }
  };

  const handlePaymentAppClick = (appId: string) => {
    // Toggle selection
    setSelectedApp(appId === selectedApp ? null : appId);

    // Special handling for Payme - use backend checkout URL
    if (appId === "payme" && paymentInfo?.checkout_url) {
      window.location.href = paymentInfo.checkout_url;
      return;
    }

    const app = PAYMENT_APPS.find((a) => a.id === appId);
    if (!app) return;

    // Use personal URL if available, otherwise generate URL with card number
    const url = app.personalUrl || app.getUrl(PAYMENT_CARD_NUMBER);
    window.open(url, "_blank");
  };

  const getAppIcon = (appId: string) => {
    switch (appId) {
      case "payme":
        return <PaymeIcon />;
      case "click":
        return <ClickIcon />;
      case "paynet":
        return <PaynetIcon />;
      case "uzum":
        return <UzumIcon />;
      case "xazna":
        return <XaznaIcon />;
      default:
        return null;
    }
  };

  if (invitationId) {
    if (paymentCheckStatus === "paid") {
      return (
        <div className="page narrow">
          <div className="payment-pending">
            <div className="payment-pending-icon payment-success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="2" fill="none" />
                <path d="M8 12l2.5 2.5 5.5-5.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>{t("paymentSuccessTitle")}</h1>
            <p className="payment-pending-message">
              {t("paymentSuccessMessage")}
            </p>
            <button
              type="button"
              className="payment-submit-btn"
              onClick={handleContinue}
            >
              {t("paymentContinue")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="page narrow">
        <div className="payment-pending">
          <div className="payment-pending-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="2" fill="none" />
              <path d="M12 6v6l4 2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>{t("paymentCheckingTitle")}</h1>
          <p className="payment-pending-message">
            {autoCheckFailed ? t("paymentCheckingRetry") : t("paymentCheckingMessage")}
          </p>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="page narrow">
        <div className="payment-pending">
          <div className="payment-pending-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="var(--accent)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M12 6v6l4 2"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>{t("paymentPendingTitle")}</h1>
          <p className="payment-pending-message">{t("paymentPendingMessage")}</p>
          <div className="payment-status-badge">
            {t("paymentStatusPending")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <div className="payment-container">
        <h1 className="payment-title">{t("paymentTitle")}</h1>

        {/* Payment Amount */}
        <div className="payment-section">
          <div className="payment-amount-label">{t("paymentAmount")}</div>
          <div className="payment-amount">{paymentAmount} {t("paymentCurrency")}</div>
        </div>

        {/* Card Number */}
        <div className="payment-section">
          <div className="payment-card-label">{t("paymentCardLabel")}</div>
          <div className="payment-card-container">
            <div className="payment-card-number">{PAYMENT_CARD_NUMBER}</div>
            <button
              type="button"
              className="payment-copy-btn"
              onClick={handleCopyCardNumber}
              aria-label={t("paymentCopyCard")}
            >
              {copied ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="payment-copy-text">{t("copied")}</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="payment-copy-text">{t("paymentCopy")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Payment Apps */}
        <div className="payment-section payment-apps-section">
          <h2 className="payment-section-title">{t("paymentChooseApp")}</h2>
          <div className="payment-apps-grid">
            {PAYMENT_APPS.map((app) => (
              <button
                key={app.id}
                type="button"
                className={`payment-app-btn ${app.id === 'xazna' ? 'payment-app-xazna' : ''} ${selectedApp === app.id ? 'payment-app-selected' : ''}`}
                onClick={() => handlePaymentAppClick(app.id)}
              >
                <div className="payment-app-icon">
                  {getAppIcon(app.id)}
                </div>
                {selectedApp === app.id && (
                  <div className="payment-app-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="var(--accent)" />
                      <path
                        d="M8 12l2.5 2.5 5.5-5.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="payment-section">
          <ol className="payment-instructions">
            <li>{t("paymentStep1")}</li>
            <li>{t("paymentStep2")}</li>
            <li>{t("paymentStep3")}</li>
          </ol>
        </div>

        {/* Receipt Upload */}
        <div className="payment-section">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="payment-file-input"
            id="receipt-upload"
          />
          {!receiptFile ? (
            <label htmlFor="receipt-upload" className="payment-upload-btn">
              <div className="flex items-center gap-2 justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {t("paymentUploadReceipt")}
            </label>
          ) : (
            <div className="payment-receipt-preview">
              <div className="payment-preview-header">
                <span className="payment-preview-title">
                  {t("paymentReceiptPreview")}
                </span>
                <button
                  type="button"
                  className="payment-remove-btn"
                  onClick={handleRemoveReceipt}
                  aria-label={t("paymentRemoveReceipt")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={t("paymentReceiptAlt")}
                  className="payment-preview-image"
                />
              )}
              <div className="payment-preview-filename">{receiptFile.name}</div>
              <button
                type="button"
                className="payment-change-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("paymentChangeReceipt")}
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="payment-error" role="alert">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          className="payment-submit-btn"
          onClick={handleSubmit}
          disabled={!receiptFile || status === "submitting"}
        >
          {status === "submitting" ? t("loading") : t("paymentSubmit")}
        </button>
      </div>
    </div>
  );
}
