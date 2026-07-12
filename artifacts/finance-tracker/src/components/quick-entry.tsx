import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Plus, Check, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { useState } from "react";
import { Mic } from "lucide-react";
import VoiceCapture, { type ParsedVoiceTx } from "@/components/voice-capture";
import CurrencyInput from "@/components/currency-input";
import MonthSelect from "@/components/month-select";
import { Link } from "wouter";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Enter a valid amount"),
  description: z.string().min(1, "Description required"),
  categoryId: z.coerce.number().min(1, "Pick a category"),
  date: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function QuickEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol, formatAmount } = useCurrency();
  const [saved, setSaved] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });

  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      description: "",
      categoryId: undefined,
      date: new Date().toISOString().slice(0, 7),
    },
  });

  const type = form.watch("type");
  const filteredCategories = Array.isArray(categories)
  ? categories.filter((c) => c.type === type || c.type === "both")
  : [];
  const onSubmit = (data: FormValues) => {
    const usdAmount = data.amount;
    const fullDate = data.date.length === 7 ? `${data.date}-01` : data.date;
    createTx.mutate(
      { data: { ...data, amount: usdAmount, date: fullDate } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          form.reset({
            type: data.type,
            amount: undefined,
            description: "",
            categoryId: undefined,
            date: new Date().toISOString().slice(0, 7),
          });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
          toast({ title: `${data.type === "income" ? "Income" : "Expense"} recorded`, description: `${formatAmount(usdAmount)} logged successfully.` });
        },
        onError: () => {
          toast({ title: "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  // Aplica el resultado de la nota de voz al formulario (para que el user confirme)
  const applyVoice = (tx: ParsedVoiceTx) => {
    setVoiceOpen(false);

    // 1) tipo primero — cambia el filtro de categorías
    form.setValue("type", tx.type, { shouldValidate: false });

    // 2) monto y descripción de inmediato
    if (tx.amount > 0) {
      form.setValue("amount", tx.amount, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
    if (tx.description) {
      form.setValue("description", tx.description, { shouldValidate: true, shouldDirty: true });
    }

    // 3) categoría en el siguiente tick: para entonces `type` ya cambió y
    //    `filteredCategories` incluye la categoría correcta (arregla income)
    if (tx.categoryId) {
      setTimeout(() => {
        form.setValue("categoryId", tx.categoryId as number, { shouldValidate: true, shouldDirty: true });
      }, 60);
    }

    const missing: string[] = [];
    if (!(tx.amount > 0)) missing.push("amount");
    if (!tx.categoryId) missing.push("category");
    if (missing.length) {
      toast({ title: "Almost — fill the rest", description: `I couldn't catch the ${missing.join(" and ")}. Add it and save.` });
    } else {
      toast({ title: "Got it — check and save", description: "Review what I understood, then tap Add." });
    }
  };

  const isIncome = type === "income";

  return (
    <div className="relative overflow-hidden rounded-3xl p-4 border-0">
      {/* Fondo EXPENSE — pastel rojo vivo con mesh */}
      <div className="absolute inset-0 transition-opacity duration-300 pointer-events-none" style={{ opacity: isIncome ? 0 : 1 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(145deg, #FFC9CE 0%, #FFA8B0 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 18% 12%, #FFDDE0 0%, transparent 50%), radial-gradient(circle at 95% 95%, #FF8A94 0%, transparent 55%)" }} />
        <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)" }} />
      </div>
      {/* Fondo INCOME — pastel verde vivo con mesh */}
      <div className="absolute inset-0 transition-opacity duration-300 pointer-events-none" style={{ opacity: isIncome ? 1 : 0 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(145deg, #A8FFDC 0%, #6FFFC0 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 18% 12%, #C9FFE9 0%, transparent 50%), radial-gradient(circle at 95% 95%, #34F5AE 0%, transparent 55%)" }} />
        <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)" }} />
      </div>
      {/* Ícono fantasma que cambia con el modo */}
      {isIncome
        ? <TrendingUp className="absolute -bottom-5 -right-4 h-32 w-32 pointer-events-none" style={{ color: "rgba(0,120,80,0.12)" }} strokeWidth={1.5} />
        : <TrendingDown className="absolute -bottom-5 -right-4 h-32 w-32 pointer-events-none" style={{ color: "rgba(200,30,50,0.12)" }} strokeWidth={1.5} />
      }
      <div className="relative">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="font-serif font-semibold text-lg" style={{ color: isIncome ? "#00593C" : "#9F1239" }}>New Entry</h3>
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            aria-label="Add by voice"
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: isIncome ? "#00593C" : "#9F1239" }}
          >
            <Mic className="h-4 w-4 text-white" />
          </button>
        </div>
        <div
          className="relative flex items-center p-1 rounded-full shrink-0 overflow-hidden"
          style={{
            backdropFilter: "blur(24px) saturate(1.6)",
            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            background: "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.08))",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Sliding glass indicator */}
          <div
            className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
            style={{
              bottom: "4px",
              width: "calc(50% - 4px)",
              transform: isIncome ? "translateX(100%)" : "translateX(0%)",
              background: isIncome
                ? "linear-gradient(135deg, rgba(29,185,84,0.95), rgba(29,185,84,0.75))"
                : "linear-gradient(135deg, rgba(255,59,59,0.95), rgba(255,59,59,0.75))",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.18)",
            }}
          />
          <button
            type="button"
            data-testid="toggle-expense"
            onClick={() => {
              form.setValue("type", "expense");
              form.setValue("categoryId", undefined as unknown as number);
            }}
            className={cn(
              "relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
              !isIncome ? "text-white" : "text-black/45 hover:text-black/70"
            )}
          >
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
            Expense
          </button>
          <button
            type="button"
            data-testid="toggle-income"
            onClick={() => {
              form.setValue("type", "income");
              form.setValue("categoryId", undefined as unknown as number);
            }}
            className={cn(
              "relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
              isIncome ? "text-white" : "text-black/45 hover:text-black/70"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            Income
          </button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
          {/* Row 1: Amount + Category */}
          <div className="flex gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="w-36 shrink-0">
                  <FormControl>
                    <CurrencyInput
                      testId="input-quick-amount"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                      className="text-base font-semibold bg-white/70 border-0 rounded-2xl text-neutral-900 placeholder:text-neutral-500"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0">
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={field.value?.toString() ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-quick-category" className="bg-white/70 border-0 rounded-2xl text-neutral-900 w-full min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-left">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <div className="py-2 px-1">
                          <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-2xl text-sm text-primary hover:bg-primary/10 transition-colors"
                            >
                              <FolderPlus className="h-4 w-4 shrink-0" />
                              Add a category
                            </button>
                          </Link>
                        </div>
                      ) : (
                        filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Row 2: Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    data-testid="input-quick-description"
                    placeholder="What was this for?"
                    className="bg-white/70 border-0 rounded-2xl text-neutral-900 placeholder:text-neutral-500"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Row 3: Date + Submit */}
          <div className="flex gap-3 items-start">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <MonthSelect
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      variant={type}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              data-testid="button-quick-save"
              disabled={createTx.isPending || saved}
              className="shrink-0 gap-1.5 transition-all h-10 px-5 border-0 text-white font-bold rounded-2xl"
              style={{
                background: saved ? "#16A34A" : isIncome ? "#166534" : "#9F1239",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {saved ? (
                <><Check className="h-4 w-4" />Saved</>
              ) : (
                <><Plus className="h-4 w-4" />{createTx.isPending ? "Saving…" : "Add"}</>
              )}
            </Button>
          </div>
        </form>
      </Form>
      </div>

      {voiceOpen && (
        <VoiceCapture onClose={() => setVoiceOpen(false)} onParsed={applyVoice} />
      )}
    </div>
  );
}
