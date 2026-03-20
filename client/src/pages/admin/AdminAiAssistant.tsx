import { useEffect, useMemo, useState } from "react";
import { MotionPageShell } from "@/animation/components/MotionPageShell";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY_CLAUDE = "glx_anthropic_key";
const STORAGE_KEY_OPENAI = "glx_openai_key";

type ProviderCardProps = {
  title: string;
  description: string;
  storageKey: string;
  placeholder: string;
  docsHref: string;
  docsLabel: string;
  accentClassName: string;
  badge: string;
};

function ProviderCard({
  title,
  description,
  storageKey,
  placeholder,
  docsHref,
  docsLabel,
  accentClassName,
  badge,
}: ProviderCardProps) {
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey) ?? "";
    setValue(stored);
    setSavedValue(stored);
  }, [storageKey]);

  const hasSavedValue = savedValue.trim().length > 0;

  const maskedValue = useMemo(() => {
    if (!savedValue) return "";
    if (savedValue.length <= 10) return "••••••••";
    return `${savedValue.slice(0, 6)}••••••${savedValue.slice(-4)}`;
  }, [savedValue]);

  const handleSave = () => {
    const next = value.trim();
    if (!next) {
      window.localStorage.removeItem(storageKey);
      setSavedValue("");
      setValue("");
      toast.success(`${title} removida do navegador.`);
      return;
    }

    window.localStorage.setItem(storageKey, next);
    setSavedValue(next);
    setValue(next);
    toast.success(`${title} salva no navegador.`);
  };

  return (
    <Card className="rounded-[28px] border-[#e8edf5] bg-white text-[#111111] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg", accentClassName)}>
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-[-0.03em] text-[#0f172a]">{title}</CardTitle>
                <CardDescription className="mt-1 text-sm leading-6 text-[#334155]">{description}</CardDescription>
              </div>
            </div>
          </div>
          <Badge className={cn("rounded-full border-0 px-3 py-1 text-xs font-semibold", hasSavedValue ? "bg-[#ecfdf3] text-[#18794e]" : "bg-[#fff7ed] text-[#c2410c]")}>
            {hasSavedValue ? "Configurada" : "Pendente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[22px] border border-[#dbe5f0] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            <Sparkles className="h-3.5 w-3.5" />
            {badge}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#111111]">
            {hasSavedValue ? `Chave salva localmente: ${maskedValue}` : "Nenhuma chave salva neste navegador ainda."}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334155]">API key</Label>
          <div className="flex gap-2">
            <Input
              type={isVisible ? "text" : "password"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              className="h-12 rounded-2xl border-[#d7e1ef] bg-white font-mono text-sm text-[#111111]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsVisible((current) => !current)}
              className="h-12 rounded-2xl border-[#d7e1ef] bg-white px-4 text-[#111111]"
            >
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#7c3aed] transition hover:text-[#6d28d9]"
          >
            {docsLabel}
            <ExternalLink className="h-4 w-4" />
          </a>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.localStorage.removeItem(storageKey);
                setSavedValue("");
                setValue("");
                toast.success(`${title} removida do navegador.`);
              }}
              className="h-11 rounded-2xl border-[#d7e1ef] bg-white px-4 text-[#111111]"
            >
              Limpar
            </Button>
            <Button type="button" onClick={handleSave} className="h-11 rounded-2xl bg-[#111111] px-5 text-white hover:bg-[#222222]">
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAiAssistant() {
  return (
    <AdminLayout>
      <MotionPageShell className="space-y-6">
        <section className="rounded-[32px] border border-[#e8edf5] bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#efe7ff] bg-[#f7f1ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7c3aed]">
                <Bot className="h-3.5 w-3.5" />
                Assistente IA
              </div>
              <h1 className="mt-4 text-[2.4rem] font-semibold leading-none tracking-[-0.06em] text-[#0f172a]">
                Credenciais do assistente
              </h1>
              <p className="mt-3 text-base leading-8 text-[#526070]">
                Centralize aqui as chaves da IA do navegador admin. O chat do dashboard deixa de pedir credenciais dentro do modal e passa a depender desta configuração.
              </p>
            </div>

            <div className="rounded-[26px] border border-[#e5f3ea] bg-[#f3fbf6] p-4 text-sm text-[#18794e] shadow-[0_12px_30px_rgba(24,121,78,0.08)]">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Armazenamento local
              </div>
              <p className="mt-2 max-w-sm leading-6 text-[#3f6f57]">
                As chaves ficam salvas apenas no navegador atual via `localStorage`. Nada aqui vai para o backend.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <ProviderCard
            title="Claude API key"
            description="Usada pelo Assistente GLX atual no dashboard para conversar com os dados analisados."
            storageKey={STORAGE_KEY_CLAUDE}
            placeholder="sk-ant-api03-..."
            docsHref="https://console.anthropic.com/settings/keys"
            docsLabel="Abrir API Keys da Claude"
            accentClassName="bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)]"
            badge="Provider principal"
          />

          <ProviderCard
            title="OpenAI API key"
            description="Campo preparado no admin para a chave da OpenAI, com acesso rápido ao link oficial de criação."
            storageKey={STORAGE_KEY_OPENAI}
            placeholder="sk-proj-..."
            docsHref="https://platform.openai.com/api-keys"
            docsLabel="Abrir API Keys da OpenAI"
            accentClassName="bg-[linear-gradient(135deg,#0f766e,#14b8a6)]"
            badge="Provider adicional"
          />
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-[26px] border-[#e8edf5] bg-white text-[#111111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-[#0f172a]">
                <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                Como fica o fluxo
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-[#111111]">
              Configure as chaves aqui no admin e depois abra o assistente no dashboard. O modal não exibe mais formulário de credenciais.
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#e8edf5] bg-white text-[#111111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-[#0f172a]">
                <KeyRound className="h-4 w-4 text-[#7c3aed]" />
                Claude
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-[#111111]">
              O assistente do dashboard continua usando a chave da Claude já existente, só que agora a configuração mora no painel admin.
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#e8edf5] bg-white text-[#111111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-[#0f172a]">
                <Bot className="h-4 w-4 text-[#0f766e]" />
                OpenAI
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-[#111111]">
              A chave da OpenAI já fica cadastrável aqui com link oficial em `platform.openai.com/api-keys`.
            </CardContent>
          </Card>
        </section>
      </MotionPageShell>
    </AdminLayout>
  );
}
