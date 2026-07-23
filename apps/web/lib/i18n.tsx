"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "zh";

const translations: Record<string, { en: string; zh: string }> = {
  "nav.howItWorks": { en: "How it works", zh: "使用方式" },
  "nav.apiDocs": { en: "API docs", zh: "API 文档" },
  "nav.support": { en: "Support", zh: "支持" },
  "nav.signup": { en: "Signup", zh: "注册" },
  "nav.login": { en: "Login", zh: "登录" },
  "nav.dashboard": { en: "Dashboard", zh: "控制面板" },
  "nav.logout": { en: "Logout", zh: "退出登录" },
  "nav.notifications": { en: "Notifications", zh: "通知" },
  "nav.language": { en: "Language", zh: "语言" },
  "nav.activate": { en: "Activate", zh: "激活" },
  "nav.profile": { en: "Profile", zh: "个人资料" },
  "nav.overview": { en: "Overview", zh: "概览" },
  "nav.live": { en: "Live", zh: "实时任务" },
  "nav.current": { en: "Current", zh: "当前任务" },
  "nav.history": { en: "History", zh: "历史记录" },
  "nav.payouts": { en: "Payouts", zh: "提现" },
  "nav.settings": { en: "Settings", zh: "设置" },
  "nav.post": { en: "Post", zh: "发布任务" },
  "nav.tasks": { en: "Tasks", zh: "任务" },
  "nav.credits": { en: "Credits", zh: "积分" },
  "nav.users": { en: "Users", zh: "用户" },
  "nav.reports": { en: "Reports", zh: "报告" },
  "nav.codes": { en: "Codes", zh: "激活码" },
  "footer.description": { en: "Post tasks, grab work in realtime, complete with proof, and settle through tracked credits and wallet ledgers.", zh: "发布任务，实时领取工作，提交证明，并通过可追踪的积分和钱包账本完成结算。" },
  "footer.platform": { en: "Platform", zh: "平台" },
  "footer.legal": { en: "Legal", zh: "法律信息" },
  "footer.createAccount": { en: "Create account", zh: "创建账户" },
  "footer.terms": { en: "Terms", zh: "条款" },
  "footer.privacy": { en: "Privacy", zh: "隐私" },
  "login.secureAccess": { en: "Secure access", zh: "安全访问" },
  "login.heroTitle": { en: "Login and continue your workflow.", zh: "登录并继续您的工作流程。" },
  "login.heroCopy": { en: "Clients post verified URL tasks, Scanners claim live work, and Admins manage credits, rewards, payouts, and settings.", zh: "客户发布经过验证的网址任务，扫描员领取实时工作，管理员管理积分、奖励、提现和设置。" },
  "login.welcome": { en: "Welcome back", zh: "欢迎回来" },
  "login.title": { en: "Sign in to your account", zh: "登录您的账户" },
  "login.copy": { en: "Use your username or email address. Your dashboard opens based on your saved role.", zh: "使用用户名或邮箱地址登录，系统会根据您的角色打开相应控制面板。" },
  "login.identifier": { en: "Username or email", zh: "用户名或邮箱" },
  "login.password": { en: "Password", zh: "密码" },
  "login.enterPassword": { en: "Enter your password", zh: "输入您的密码" },
  "login.remember": { en: "Remember me", zh: "记住我" },
  "login.needHelp": { en: "Need help?", zh: "需要帮助？" },
  "login.signingIn": { en: "Signing in...", zh: "正在登录..." },
  "login.button": { en: "Login", zh: "登录" },
  "login.newUser": { en: "New to Scan Krwalo?", zh: "还没有 Scan Krwalo 账户？" },
  "login.createAccount": { en: "Create an account", zh: "创建账户" },
  "login.opening": { en: "Opening dashboard", zh: "正在打开控制面板" },
  "login.checking": { en: "Checking your active session...", zh: "正在检查您的登录状态..." },
  "signup.startRole": { en: "Start with a role", zh: "选择账户角色" },
  "signup.title": { en: "Create your Scan Krwalo account.", zh: "创建您的 Scan Krwalo 账户。" },
  "signup.heroCopy": { en: "Choose Client to post work, Scanner to activate with an SCN code after login, or Admin with the private setup secret.", zh: "选择客户来发布任务，选择扫描员并在登录后使用 SCN 激活码，或使用私有设置密钥创建管理员。" },
  "signup.label": { en: "Signup", zh: "注册" },
  "signup.formTitle": { en: "Set up your account", zh: "设置您的账户" },
  "signup.formCopy": { en: "Client is selected by default. Scanner accounts require an SCN code after login.", zh: "默认选择客户账户。扫描员账户登录后需要 SCN 激活码。" },
  "signup.username": { en: "Username", zh: "用户名" },
  "signup.email": { en: "Email", zh: "邮箱" },
  "signup.password": { en: "Password", zh: "密码" },
  "signup.confirmPassword": { en: "Confirm password", zh: "确认密码" },
  "signup.create": { en: "Create account", zh: "创建账户" },
  "signup.creating": { en: "Creating account...", zh: "正在创建账户..." },
  "signup.existing": { en: "Already have an account?", zh: "已经有账户？" },
  "signup.role.client": { en: "Client", zh: "客户" },
  "signup.role.scanner": { en: "Scanner", zh: "扫描员" },
  "signup.role.admin": { en: "Admin", zh: "管理员" },
  "signup.role.clientCopy": { en: "Post URL tasks and manage credits.", zh: "发布网址任务并管理积分。" },
  "signup.role.scannerCopy": { en: "Grab tasks and earn rewards.", zh: "领取任务并赚取奖励。" },
  "signup.role.adminCopy": { en: "Manage platform operations.", zh: "管理平台运营。" },
  "signup.createdScanner": { en: "Account created. Login now, then enter your SCN activation code.", zh: "账户已创建。请先登录，然后输入您的 SCN 激活码。" },
  "signup.created": { en: "Account created. You can log in now.", zh: "账户已创建。现在可以登录。" },
  "app.languageEnglish": { en: "English", zh: "English" },
  "app.languageChinese": { en: "中文", zh: "中文" }
};

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = window.localStorage.getItem("scan-krwalo-locale");
    if (saved === "en" || saved === "zh") setLocaleState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("scan-krwalo-locale", locale);
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale: setLocaleState, t: (key: string) => translations[key]?.[locale] ?? translations[key]?.en ?? key }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-line bg-white p-1 text-xs" aria-label={t("nav.language")}>
      <button type="button" onClick={() => setLocale("en")} aria-pressed={locale === "en"} className={`rounded px-2 py-1 font-semibold ${locale === "en" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>{t("app.languageEnglish")}</button>
      <button type="button" onClick={() => setLocale("zh")} aria-pressed={locale === "zh"} className={`rounded px-2 py-1 font-semibold ${locale === "zh" ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>{t("app.languageChinese")}</button>
    </div>
  );
}
