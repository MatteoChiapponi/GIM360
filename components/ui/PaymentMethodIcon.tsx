import type { PaymentMethodValue } from "@/lib/payment-methods"

/** Ícono del medio de pago — compartido entre el cobro de cuotas y su configuración. */
export function PaymentMethodIcon({ method, className = "h-6 w-6" }: { method: PaymentMethodValue; className?: string }) {
  if (method === "CASH") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
        <path fillRule="evenodd" d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z" clipRule="evenodd" />
      </svg>
    )
  }

  if (method === "TRANSFER") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
        <path d="M13.024 9.25c.47 0 .827-.433.637-.863a4 4 0 0 0-4.094-2.364c-.468.05-.665.576-.43.984l1.08 1.868a.75.75 0 0 0 .649.375h2.158ZM7.84 7.758c-.236-.408-.79-.5-1.068-.12A3.982 3.982 0 0 0 6 10c0 .884.287 1.7.772 2.363.278.38.832.287 1.068-.12l1.078-1.868a.75.75 0 0 0 0-.75L7.839 7.758ZM9.138 12.993c-.235.408-.039.934.43.984a4 4 0 0 0 4.094-2.364c.19-.43-.168-.863-.638-.863h-2.158a.75.75 0 0 0-.65.375l-1.078 1.868Z" />
        <path fillRule="evenodd" d="M14.13 4.347l.644-1.117a.75.75 0 0 0-1.299-.75l-.644 1.116a20.944 20.944 0 0 0-5.662 0L6.525 2.48a.75.75 0 0 0-1.3.75l.645 1.117A20.943 20.943 0 0 0 1 10c0 1.68.211 3.31.6 4.866h.159c2.742 0 5.39-.472 7.84-1.339a21.489 21.489 0 0 0 7.842 1.339h.158c.39-1.556.601-3.186.601-4.866 0-2.07-.338-4.06-.958-5.924l-.112.27Zm-3.788 1.903a.75.75 0 0 0-1.299-.75l-1.28 2.217a.75.75 0 0 0 0 .75l1.28 2.217a.75.75 0 0 0 1.3-.75L9.262 8l1.08-1.867v.117ZM3.5 10a6.5 6.5 0 0 1 6.5-6.5c.834 0 1.64.158 2.377.446a.75.75 0 1 0 .523-1.406A7.956 7.956 0 0 0 10 2a8 8 0 1 0 7.934 7.071.75.75 0 1 0-1.49.178A6.5 6.5 0 0 1 3.5 10Z" clipRule="evenodd" />
      </svg>
    )
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
    </svg>
  )
}
