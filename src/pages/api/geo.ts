import type { APIRoute } from "astro";
import { createGeoResponse } from "@/integrations/preferences/consent/server/geoResponse";

export const prerender = false;

export const GET: APIRoute = ({ request }) => createGeoResponse(request);
