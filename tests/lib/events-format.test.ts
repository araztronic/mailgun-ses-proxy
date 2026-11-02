import { describe, it, expect } from 'vitest'
import { formatAsMailgunEvent } from '@/lib/email/events'

function payload(sesEvent: object, wrapped = false) {
    const rawEvent = JSON.stringify(wrapped ? { Type: "Notification", Message: JSON.stringify(sesEvent) } : sesEvent)
    return {
        id: "1", messageId: "m1", type: "failed", rawEvent,
        timestamp: new Date("2026-01-01T00:00:00Z"), created: new Date("2026-01-01T00:00:00Z"),
        newsletter: { toEmail: "a@example.com", newsletterBatch: { batchId: "batch1" } },
    } as any
}

const bounce = (bounceType: string, extra = {}) => ({
    eventType: "Bounce",
    bounce: { bounceType, bounceSubType: "General", bouncedRecipients: [{ status: "5.1.1", diagnosticCode: "smtp; 550 5.1.1 user unknown", ...extra }] },
})

describe("formatAsMailgunEvent bounces", () => {
    it("emits permanent severity and delivery-status Ghost needs to suppress", () => {
        const [e] = formatAsMailgunEvent([payload(bounce("Permanent"))], "next").items as any[]
        expect(e.severity).toBe("permanent")
        expect(e["delivery-status"]).toEqual({ code: 550, message: "smtp; 550 5.1.1 user unknown", "enhanced-code": "5.1.1" })
    })

    it("still works when the stored event is wrapped in an SNS envelope", () => {
        const [e] = formatAsMailgunEvent([payload(bounce("Permanent"), true)], "next").items as any[]
        expect(e.severity).toBe("permanent")
        expect(e["delivery-status"].code).toBe(550)
    })

    it("marks transient bounces temporary and falls back when no diagnostic code", () => {
        const [e] = formatAsMailgunEvent([payload(bounce("Transient", { diagnosticCode: undefined, status: "4.2.2" }))], "next").items as any[]
        expect(e.severity).toBe("temporary")
        expect(e["delivery-status"]).toMatchObject({ code: 450, "enhanced-code": "4.2.2" })
    })

    it("leaves non-bounce events without severity or delivery-status", () => {
        const [e] = formatAsMailgunEvent([payload({ eventType: "Delivery" })], "next").items as any[]
        expect(e.severity).toBeUndefined()
        expect(e["delivery-status"]).toBeUndefined()
    })
})
