const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  const label = MONTH_NAMES[(month - 1) % 12] ?? "?";
  return `${label} ${year}`;
}
