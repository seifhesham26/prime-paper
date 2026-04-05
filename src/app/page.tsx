import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ScrollText, ArrowRight, ShieldCheck, Zap, Globe, PackageOpen } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30 flex flex-col overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ScrollText className="h-5 w-5" />
             </div>
             <span className="text-xl font-bold tracking-tight">Prime Paper</span>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <Button asChild variant="ghost" className="gap-2">
                <Link href="/dashboard">
                  {t("viewDashboard")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button asChild className="shadow-lg hover:shadow-primary/20 transition-all">
                  <Link href="/auth/signup">{t("getStarted")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow pt-32 pb-20 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full h-full pointer-events-none opacity-20 dark:opacity-30">
           <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-primary rounded-full blur-[120px] animate-pulse" />
           <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-accent rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="container mx-auto px-6 text-center lg:text-left flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="max-w-2xl space-y-8 animate-in slide-in-from-left duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
               <Zap className="h-4 w-4 fill-primary" />
               <span>{t("heroTagline")}</span>
            </div>
            
            <h1 className="text-6xl lg:text-8xl font-black tracking-tight leading-[0.9] bg-linear-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
               {t("title")}
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed">
               {t("description")}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Button asChild size="lg" className="h-14 px-8 text-md rounded-2xl shadow-xl hover:shadow-primary/25 transition-all gap-2 group">
                 <Link href={session ? "/dashboard" : "/auth/signup"}>
                    {session ? t("viewDashboard") : t("getStarted")}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                 </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 text-md rounded-2xl border-2 hover:bg-muted/50 transition-colors">
                 <Link href="/auth/login">Access Management Portal</Link>
              </Button>
            </div>
            
            {/* Trust Badges/Features */}
            <div className="pt-10 flex flex-wrap gap-8 items-center justify-center lg:justify-start grayscale opacity-60">
               <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" /> Enterprise Secure</div>
               <div className="flex items-center gap-2 font-semibold"><Globe className="h-5 w-5" /> Multi-lingual Support</div>
               <div className="flex items-center gap-2 font-semibold"><PackageOpen className="h-5 w-5" /> Inventory Optimized</div>
            </div>
          </div>

          {/* Hero Visual Block */}
          <div className="relative w-full max-w-lg lg:max-w-xl animate-in fade-in zoom-in duration-1000 delay-300">
             <div className="aspect-square relative rounded-[3rem] overflow-hidden border border-border bg-card/30 backdrop-blur-3xl shadow-2xl p-8 flex flex-col justify-center gap-8">
                <div className="space-y-2">
                   <div className="h-3 w-1/3 bg-primary/30 rounded-full animate-pulse" />
                   <div className="h-3 w-3/4 bg-primary/20 rounded-full animate-pulse delay-100" />
                   <div className="h-3 w-1/2 bg-primary/20 rounded-full animate-pulse delay-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="h-32 bg-muted/40 rounded-3xl border border-border animate-in slide-in-from-bottom-5 duration-700" />
                   <div className="h-32 bg-primary/10 rounded-3xl border border-primary/20 animate-in slide-in-from-bottom-5 duration-700 delay-100" />
                </div>
                <div className="h-40 bg-card rounded-3xl border border-border shadow-inner p-6">
                   <div className="flex items-center justify-between mb-4">
                      <div className="h-4 w-1/4 bg-muted rounded-full" />
                      <div className="h-8 w-8 bg-primary rounded-full" />
                   </div>
                   <div className="space-y-2">
                      <div className="h-2 w-full bg-muted rounded-full" />
                      <div className="h-2 w-5/6 bg-muted rounded-full" />
                   </div>
                </div>
             </div>
             
             {/* Floating UI elements */}
             <div className="absolute -top-6 -right-6 h-20 w-56 bg-emerald-500/10 backdrop-blur-md rounded-2xl border border-emerald-500/20 p-4 flex items-center gap-4 shadow-xl animate-bounce duration-[3000ms]">
                <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-white shadow-lg">✓</div>
                <div>
                   <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Production Yield</p>
                   <p className="text-lg font-black">+94%</p>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Basic Footer */}
      <footer className="border-t border-border mt-auto py-12 bg-muted/20">
         <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-muted-foreground text-sm">© 2026 Prime Paper Company. Professional Factory Management.</p>
            <div className="flex gap-8 text-sm font-medium text-muted-foreground">
               <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
               <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
               <Link href="#" className="hover:text-foreground transition-colors">Contact Support</Link>
            </div>
         </div>
      </footer>
    </div>
  );
}
