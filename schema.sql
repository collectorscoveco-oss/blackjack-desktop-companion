-- Driver Cash Tool relational schema (future-ready SQL version)

create table drivers (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table transactions (
  id text primary key,
  business_date date not null,
  driver_id text not null references drivers(id),
  driver_name text not null,
  order_number text not null,
  order_total numeric(10,2) not null,
  assumed_bill numeric(10,2) not null,
  give_driver numeric(10,2) not null,
  customer_paid numeric(10,2) not null,
  back_to_register numeric(10,2) not null,
  driver_tip numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table daily_summaries (
  business_date date primary key,
  total_transactions integer not null,
  total_give_driver numeric(10,2) not null,
  total_back_to_register numeric(10,2) not null,
  total_driver_tips numeric(10,2) not null,
  updated_at timestamptz not null default now()
);

create index idx_transactions_business_date on transactions (business_date);
create index idx_transactions_driver_id on transactions (driver_id);
