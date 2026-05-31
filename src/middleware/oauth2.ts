// src/middleware/oauth2.ts
import { Request, Response, NextFunction } from "express";
import qs from "qs";

export function parseOAuth2Form(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
    // Parse form data into req.body
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      req.body = qs.parse(body);
      next();
    });
  } else {
    next();
  }
}
