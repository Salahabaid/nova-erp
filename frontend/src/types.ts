export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type UserMe = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  role?: { slug: string; name: string };
  role_slug: string;
  permissions: string[];
  modules: Record<string, boolean>;
  onboarding_completed: boolean;
  company: Company;
};

export type Company = {
  id?: string;
  name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  currency?: string;
  default_tax_rate?: number;
  language?: string;
  onboarding_completed?: boolean;
};

export type Party = {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  notes?: string;
  status: string;
  created_at?: string;
  balance?: { invoiced: number; paid: number; balance: number; open_invoices: number };
  orders?: any[];
  invoices?: any[];
  payments?: any[];
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  purchase_price: number;
  sale_price: number;
  tax_rate: number;
  unit: string;
  stock_quantity: number;
  min_stock: number;
  supplier_id?: string;
  image_url?: string;
  status: string;
  categories?: { name: string };
  suppliers?: { name: string };
};

export type Line = {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  line_total?: number;
  received_qty?: number;
  delivered_qty?: number;
};

export type Doc = {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  subtotal: number;
  discount: number;
  tax_amount: number;
  total: number;
  paid_amount?: number;
  notes?: string;
  customer_id?: string;
  supplier_id?: string;
  customers?: { name: string };
  suppliers?: { name: string };
  quote_items?: Line[];
  sales_order_items?: Line[];
  purchase_order_items?: Line[];
  invoice_items?: Line[];
  [key: string]: any;
};
