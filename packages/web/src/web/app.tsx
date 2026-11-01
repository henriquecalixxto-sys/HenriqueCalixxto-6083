import { Route, Switch } from "wouter";
import Index from "./pages/index";
import AboutPage from "./pages/about";
import ServicesIndexPage from "./pages/services/index";
import ServiceDetailPage from "./pages/services/detail";
import FaqPage from "./pages/faq";
import TestimonialsPage from "./pages/testimonials";
import FeedbackPage from "./pages/feedback";
import BlogIndexPage from "./pages/blog/index";
import BlogDetailPage from "./pages/blog/detail";
import ContactPage from "./pages/contact";
import RequestQuotePage from "./pages/request-quote";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import TwoFactorPage from "./pages/two-factor";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import PortalDashboardPage from "./pages/portal/dashboard";
import PortalOrdersPage from "./pages/portal/orders";
import PortalDocumentsPage from "./pages/portal/documents";
import PortalMessagesPage from "./pages/portal/messages";
import PortalSecurityPage from "./pages/portal/security";
import AdminDashboardPage from "./pages/admin/dashboard";
import AdminServicesPage from "./pages/admin/services";
import AdminBlogPage from "./pages/admin/blog";
import AdminTestimonialsPage from "./pages/admin/testimonials";
import AdminFeedbackPage from "./pages/admin/feedback";
import AdminAuditPage from "./pages/admin/audit";
import AdminSecurityPage from "./pages/admin/security";
import AdminSecurityReportPage from "./pages/admin/security-report";
import AdminFaqsPage from "./pages/admin/faqs";
import AdminQuotesPage from "./pages/admin/quotes";
import AdminContactsPage from "./pages/admin/contacts";
import AdminClientsPage from "./pages/admin/clients";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/about" component={AboutPage} />
        <Route path="/how-it-works" component={Index} />
        <Route path="/services" component={ServicesIndexPage} />
        <Route path="/services/:slug" component={ServiceDetailPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/testimonials" component={TestimonialsPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/blog" component={BlogIndexPage} />
        <Route path="/blog/:slug" component={BlogDetailPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/request-quote" component={RequestQuotePage} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/two-factor" component={TwoFactorPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/portal" component={PortalDashboardPage} />
        <Route path="/portal/orders" component={PortalOrdersPage} />
        <Route path="/portal/documents" component={PortalDocumentsPage} />
        <Route path="/portal/messages" component={PortalMessagesPage} />
        <Route path="/portal/security" component={PortalSecurityPage} />
        <Route path="/admin" component={AdminDashboardPage} />
        <Route path="/admin/services" component={AdminServicesPage} />
        <Route path="/admin/blog" component={AdminBlogPage} />
        <Route path="/admin/testimonials" component={AdminTestimonialsPage} />
        <Route path="/admin/feedback" component={AdminFeedbackPage} />
        <Route path="/admin/audit" component={AdminAuditPage} />
        <Route path="/admin/security" component={AdminSecurityPage} />
        <Route path="/admin/security-report" component={AdminSecurityReportPage} />
        <Route path="/admin/faqs" component={AdminFaqsPage} />
        <Route path="/admin/quotes" component={AdminQuotesPage} />
        <Route path="/admin/contacts" component={AdminContactsPage} />
        <Route path="/admin/clients" component={AdminClientsPage} />
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
