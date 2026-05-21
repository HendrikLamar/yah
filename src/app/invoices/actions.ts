"use server";

import { redirect } from "next/navigation";

import { getViewerHouseholdContext } from "@/lib/household/viewer";
import {
  clearInvoiceMatch,
  confirmInvoiceMatch,
} from "@/lib/invoices/invoice-queries";
import { uploadInvoiceDocument } from "@/lib/invoices/invoice-upload";

export async function uploadInvoiceAction(formData: FormData) {
  const context = await getViewerHouseholdContext();

  if (!context.viewer) {
    redirect("/settings?error=Bitte+zuerst+anmelden");
  }

  const file = formData.get("invoiceFile");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/invoices?error=Bitte+eine+Rechnung+hochladen");
  }

  const vendorName = String(formData.get("vendorName") ?? "").trim();
  const invoiceDate = String(formData.get("invoiceDate") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const amountRaw = String(formData.get("totalAmount") ?? "").trim().replace(",", ".");
  const totalAmount = amountRaw ? Number(amountRaw) : null;

  let result: Awaited<ReturnType<typeof uploadInvoiceDocument>>;
  try {
    result = await uploadInvoiceDocument({
      householdId: context.householdId,
      uploadedByUserId: context.viewer.userId,
      file,
      vendorName: vendorName || null,
      invoiceNumber: invoiceNumber || null,
      invoiceDate: invoiceDate || null,
      dueDate: dueDate || null,
      totalAmount,
      currency: "EUR",
      notes: notes || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rechnung konnte nicht gespeichert werden.";
    redirect(`/invoices?error=${encodeURIComponent(message)}`);
  }

  const params = new URLSearchParams({
    uploaded: "1",
    file: result.fileName,
    status: result.matchStatus,
  });

  if (result.matchedTransaction) {
    params.set("transaction", result.matchedTransaction.id);
  }

  if (result.linkedPaymentCount > 1) {
    params.set("allocations", String(result.linkedPaymentCount));
  }

  redirect(`/invoices?${params.toString()}`);
}

export async function confirmInvoiceMatchAction(formData: FormData) {
  const context = await getViewerHouseholdContext();

  if (!context.viewer) {
    redirect("/settings?error=Bitte+zuerst+anmelden");
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const filter = String(formData.get("filter") ?? "all").trim();
  const allocatedAmountRaw = String(formData.get("allocatedAmount") ?? "").trim().replace(",", ".");
  const allocatedAmount = allocatedAmountRaw ? Number(allocatedAmountRaw) : null;

  if (!invoiceId || !transactionId) {
    redirect(`/invoices?error=${encodeURIComponent("Bitte Rechnung und Zahlung auswählen.")}&filter=${encodeURIComponent(filter)}`);
  }

  try {
    await confirmInvoiceMatch({
      householdId: context.householdId,
      invoiceId,
      transactionId,
      allocatedAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match konnte nicht gespeichert werden.";
    redirect(`/invoices?error=${encodeURIComponent(message)}&filter=${encodeURIComponent(filter)}`);
  }

  redirect(`/invoices?updated=1&filter=${encodeURIComponent(filter)}`);
}

export async function clearInvoiceMatchAction(formData: FormData) {
  const context = await getViewerHouseholdContext();

  if (!context.viewer) {
    redirect("/settings?error=Bitte+zuerst+anmelden");
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const filter = String(formData.get("filter") ?? "all").trim();

  if (!invoiceId) {
    redirect(`/invoices?error=${encodeURIComponent("Bitte eine Rechnung auswählen.")}&filter=${encodeURIComponent(filter)}`);
  }

  try {
    await clearInvoiceMatch({
      householdId: context.householdId,
      invoiceId,
      transactionId: transactionId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match konnte nicht gelöst werden.";
    redirect(`/invoices?error=${encodeURIComponent(message)}&filter=${encodeURIComponent(filter)}`);
  }

  redirect(`/invoices?updated=1&filter=${encodeURIComponent(filter)}`);
}
