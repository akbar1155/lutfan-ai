import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { AccountPage, SettingsPage } from "./pages/AccountPages";
import AdminPage from "./pages/AdminPage";
import {
  CreateEventPage,
  DataPage,
  DetailsPage,
  GeneratingPage,
  ResultPage,
  StyleAiPage,
  StylePage,
  StyleTemplatesPage,
  TextPage,
} from "./pages/CreateWizard";
import HomePage from "./pages/HomePage";
import {
  FaqPage,
  GalleryPage,
  HowItWorksPage,
  PrivacyPage,
  PublicInvitationPage,
  TermsPage,
} from "./pages/StaticPages";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/privacy-policy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/i/:id" element={<PublicInvitationPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/create" element={<CreateEventPage />} />
            <Route path="/create/:id/details" element={<DetailsPage />} />
            <Route path="/create/:id/data" element={<DataPage />} />
            <Route path="/create/:id/text" element={<TextPage />} />
            <Route path="/create/:id/style" element={<StylePage />} />
            <Route path="/create/:id/style/templates" element={<StyleTemplatesPage />} />
            <Route path="/create/:id/style/ai" element={<StyleAiPage />} />
            <Route path="/create/:id/generating" element={<GeneratingPage />} />
            <Route path="/create/:id/result" element={<ResultPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
