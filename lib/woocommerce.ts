import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api'

export const wooApi = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WC_URL!,
  consumerKey: process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version: 'wc/v3',
})

export interface WooCommerceOrder {
  id: number
  number: string
  status: string
  date_created: string
  total: string
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address_1: string
    address_2: string
    city: string
    state: string
    postcode: string
    country: string
  }
  payment_method: string
  payment_method_title: string
  line_items: Array<{
    id: number
    name: string
    quantity: number
    total: string
    price: number
    product_id: number
    meta_data: any[]
  }>
  customer_id: number
}
