export type PaymentApp = {
  id: string;
  name: string;
  getUrl: (cardNumber: string) => string;
  personalUrl?: string;
};

// Destination card number for payments
export const PAYMENT_CARD_NUMBER = "8600123456781234";

// Personal payment links (from MeCard context)
const PERSONAL_LINKS = {
  xazna: "https://pay.xazna.uz/p2p/349e4048-5300-4f70-847c-b36478bf58f7",
  uzum: "https://b.2u.uz/ttc?qr=Nzk5Mzo5NDM0NjMwOjAxS042U1kxUFBOUjBDOUQ0MDlQWVBESDJFOnllWEI2L0EzaHlMUkZBbUw2YjM1c3ppVDRwbz0",
  click: "https://my.click.uz/clickp2p/AB2E1235F6BA24A451C56E3BFFD2C907DD5A14DE1156C32A6363E9D70CAFD5B8",
};

export const PAYMENT_APPS: PaymentApp[] = [
  {
    id: "payme",
    name: "Payme",
    getUrl: () => `https://checkout.paycom.uz`,
    // Payme checkout URL should come from backend API
  },
  {
    id: "uzum",
    name: "Uzum",
    getUrl: () => PERSONAL_LINKS.uzum,
    personalUrl: PERSONAL_LINKS.uzum,
  },
  {
    id: "click",
    name: "Click",
    getUrl: (cardNumber: string) => `https://my.click.uz/app/webView?card=${cardNumber}`,
    personalUrl: PERSONAL_LINKS.click,
  },
  {
    id: "xazna",
    name: "Xazna",
    getUrl: () => PERSONAL_LINKS.xazna,
    personalUrl: PERSONAL_LINKS.xazna,
  },
];
