import assert from "node:assert/strict";
import test from "node:test";
import { ruleFilter } from "./ruleFilter";

test("NIC IP GET 200 -> DISCARD", () => {
  const result = ruleFilter({
    timestamp: new Date().toISOString(),
    source_ip: "164.100.12.9",
    endpoint: "/api/voter/profile",
    method: "GET",
    status_code: 200,
    user_agent: "Mozilla/5.0",
    response_time: 40,
    bytes_sent: 1024,
    source: "voter-auth-api",
    service: "voter-auth-api",
    req_per_min: 4,
  });

  assert.equal(result, "DISCARD");
});

test("UNION SELECT in URL -> ESCALATE_CRITICAL", () => {
  const result = ruleFilter({
    timestamp: new Date().toISOString(),
    source_ip: "203.0.113.10",
    endpoint: "/search?q=1 UNION SELECT password FROM users",
    method: "GET",
    status_code: 400,
    user_agent: "Mozilla/5.0",
    response_time: 140,
    bytes_sent: 900,
    source: "rti-portal",
    service: "rti-portal",
    req_per_min: 2,
  });

  assert.equal(result, "ESCALATE_CRITICAL");
});

test("Unknown IP POST 401 x45 -> PASS_TO_ML", () => {
  const result = ruleFilter({
    timestamp: new Date().toISOString(),
    source_ip: "203.0.113.200",
    endpoint: "/auth/login",
    method: "POST",
    status_code: 401,
    user_agent: "CredentialSpray/5.1",
    response_time: 95,
    bytes_sent: 1300,
    source: "aadhaar-verify-service",
    service: "aadhaar-verify-service",
    req_per_min: 45,
  });

  assert.equal(result, "PASS_TO_ML");
});

test(".css file request -> DISCARD", () => {
  const result = ruleFilter({
    timestamp: new Date().toISOString(),
    source_ip: "198.51.100.5",
    endpoint: "/static/app.css",
    method: "GET",
    status_code: 200,
    user_agent: "Mozilla/5.0",
    response_time: 12,
    bytes_sent: 3200,
    source: "municipal-portal",
    service: "municipal-portal",
    req_per_min: 2,
  });

  assert.equal(result, "DISCARD");
});
