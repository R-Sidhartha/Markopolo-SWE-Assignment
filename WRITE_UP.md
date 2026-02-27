What was going wrong:

The original bug was mainly a race condition. 
The service was doing: read the event → check available tickets → insert tickets → then update available. 
This works fine if requests come one by one, but when many users try at same time, multiple requests read the same available value. They all pass the check and proceed. 
That caused two issues:
    1. More tickets were sold than total capacity (overselling).
    2. Same ticket numbers were assigned to different users, because ticket numbers were calculated from total - available,     which was stale under concurrency.
There was no transaction or atomic operation protecting this logic


How I Reproduced the Bugs:

To reproduce the bug properly, I wrote a script (repro.ts) which first resets a test event with a small fixed number of tickets (for example 64). 
Then it sends a lot of concurrent/purchase requests, like 100s at the same time and each request tries to buy 8 tickets.
After all the requests finish, the script checks the database state — it looks at the final available value, counts how many tickets were actually issued, and also checks if any ticket_number appears more than once.
With the original code, this almost always shows the problem clearly. More tickets get issued than the event total, availability can go negative or not match properly, and duplicate ticket numbers exist for the same event. So the race condition becomes very evident with this test.



How I fixed it:

I replaced the logic with a single atomic SQL operation using a conditional UPDATE ... WHERE available >= quantity RETURNING inside a CTE. 
If there are not enough tickets, then update simply affects 0 rows and nothing is inserted.
Then I just generate the ticket numbers using generate_series based on the updated state. Since Postgres locks the row during update, concurrent requests for the same event are handled safely.
I also added:
CHECK constraints (available >= 0, available <= total)
A unique index on (event_id, ticket_number)
So even if something breaks later, the DB won’t allow invalid state.


Tradeoffs Considered:

I thought about using a normal transaction with SELECT ... FOR UPDATE. That would lock the row first, then do the checks and inserts inside a transaction. It’s simple and easy to understand. But it’s a bit more verbose and you have to manage transactions carefully in code. Also it can block more than needed.

Instead of that, I went with atomic conditional UPDATE using RETURNING and CTEs. This handles the availability check and deduction happen in one step. It’s just one round trip to the DB and relies on Postgres row-level locking internally. It’s cleaner and scales better in my opinion. The SQL is slightly more complex, especially calculating ticket ranges, but overall it felt more solid under high concurrency.


Scalability:

If traffic becomes very high (like thousands of users at same time), the main idea is simple — don’t add extra locks in app, just let database handle it properly.
In my design, only people buying for the same event will affect each other. Other events run separately, so they don’t slow everything. Also the app is stateless, so we can just run many copies of it behind a load balancer and it should work fine.
If it grows even bigger, we can split tables, add read replicas, or divide events across systems. But even now, it is safe and handles high traffic in a clean way.