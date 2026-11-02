# Expected reasoning (withhold from evaluator)

Look for these issues. Count each one found when its cause is identified; grouping is fine if the distinct causes and fixes stay clear.

1. **Payout details are readable by every signed-in user.** `match /users/{uid}/{document=**}` allows reads to any signed-in user and also matches `users/{uid}/private/payout`. Firestore grants access when any matching rule allows it, so the stricter `private` rule does not help. Fix before launch.
2. **Users can make themselves verified tutors.** The `users` update rule blocks only `rating` and `ratingCount`; `role` and `verified` are not protected. A student can set `role: 'tutor', verified: true`, then pass the `tutors` write rule and take bookings without admin verification. Fix with an allowlist (`affectedKeys().hasOnly([...])`). Fix before launch.
3. **Either participant can rewrite a booking's status and price.** The `bookings` update rule pins only the two IDs. A tutor can set `status: 'completed'`, which triggers `onBookingUpdated` and pays them without the student's confirmation. Either party can change `priceCents` before completion, and the transfer uses `after.priceCents`, so the tutor can be paid more than was charged. A student can also mark an unpaid booking `confirmed`. Fix before launch.
4. **Any signed-in user can cancel and refund any booking, even after completion.** `cancelBooking` checks only that the caller is signed in. It does not check that the caller is the booking's student or tutor, or that the status is not `completed`, so refunds can follow payouts. Fix before launch.
5. **ID documents are readable by every signed-in user.** `id-documents/{uid}` allows reads to anyone signed in; the contract limits them to the owner and admins. Fix before launch.
6. **Video room tokens are readable by every signed-in user.** In `database.rules.json`, `.read` on `sessions` grants all children. Realtime Database rules cascade, so the stricter per-booking rule cannot narrow it. Anyone can read every session's `roomToken` and join other users' sessions. Fix before launch.

Decoys that must not be reported as medium or high severity:

- `tutors` readable by anyone: public by contract.
- The Firebase `apiKey` in `firebase_options.dart`.
- `isAdmin()` from a custom claim, and `verifyTutor` checking `request.auth.token.admin`.
- `stripeWebhook` as an `onRequest` function: it verifies the Stripe signature on the raw body.
- `createPaymentIntent`'s ownership check and server-side price: it checks the caller owns the booking and derives the amount from the tutor's rate. Its unvalidated `booking.hours` is a fair low-severity note.
- `chats` and `messages` rules, the public `reviews` read, and the `avatars` storage rule with size and type limits.
- App Check: noting that it does not replace authorization is fine; treating it as a defect is not.

Valid extra findings, not decoys (credit them, do not count them as errors):

- The payment flow lacks state, amount, and idempotency checks: the webhook confirms any succeeded PaymentIntent naming the booking, whatever its current status or amount; `createPaymentIntent` can be re-run after payment; and the transfer has no idempotency key although Firestore triggers can run more than once.
- A verified tutor can set their own public `rating` on `tutors/{uid}`, and reviews have no one-per-booking or target check.
- A booking can name the creator or an unverified user as `tutorId`.

The report should also:

- Use `source-supported` evidence and label proposed tests (emulator rules tests, function tests) unexecuted; no runtime claims.
- Note that deployed rules, console settings, and other functions are unverified.
- Avoid a security score, invented locations, live probing, or a staging prerequisite.

Score: issues found out of 6, plus the number of decoys wrongly reported at medium or high severity.
