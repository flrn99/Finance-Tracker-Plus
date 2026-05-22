import { useLocation } from "wouter";
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
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/lib/currency-context";
import CurrencyInput from "@/components/currency-input";
import MonthSelect from "@/components/month-select";

const formSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().min(2, "Description is required"),
  date: z.string().min(1, "Date is required"),
  categoryId: z.coerce.number().min(1, "Category is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTransaction() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { rate } = useCurrency();

  const { data: categories, isLoading: isLoadingCategories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      description: "",
      date: new Date().toISOString().slice(0, 7),
      categoryId: undefined,
      notes: "",
    },
  });

  const type = form.watch("type");
  const filteredCategories = categories?.filter(c => c.type === type || c.type === 'both') || [];

  const onSubmit = (data: FormValues) => {
    const usdAmount = Math.round((data.amount / rate) * 10000) / 10000;
    const fullDate = data.date.length === 7 ? `${data.date}-01` : data.date;
    createTx.mutate(
      { data: { ...data, amount: usdAmount, date: fullDate } },
      {
        onSuccess: () => {
          toast({ title: "Transaction added successfully" });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
          setLocation("/transactions");
        },
        onError: () => {
          toast({ title: "Failed to add transaction", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/transactions">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">New Transaction</h2>
          <p className="text-muted-foreground mt-1">Record a new income or expense.</p>
        </div>
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 pt-6">

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0 border rounded-xl p-4 flex-1 cursor-pointer [&:has([data-state=checked])]:border-expense [&:has([data-state=checked])]:bg-expense/5">
                          <FormControl><RadioGroupItem value="expense" className="text-expense" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer w-full">Expense</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0 border rounded-xl p-4 flex-1 cursor-pointer [&:has([data-state=checked])]:border-income [&:has([data-state=checked])]:bg-income/5">
                          <FormControl><RadioGroupItem value="income" className="text-income" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer w-full">Income</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="0.00"
                          className="text-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <MonthSelect
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          variant={type}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Groceries, Rent, Salary..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString() ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCategories.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any extra details here..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t bg-muted/20 px-6 py-4">
              <Link href="/transactions">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createTx.isPending}>
                {createTx.isPending ? "Saving..." : "Save Transaction"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
