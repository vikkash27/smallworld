import { handleWhatsApp } from "@/server/platform/whatsapp/handlers";
export const runtime = "nodejs";
export const GET = handleWhatsApp;
export const POST = handleWhatsApp;
export const PUT = handleWhatsApp;
export const DELETE = handleWhatsApp;
