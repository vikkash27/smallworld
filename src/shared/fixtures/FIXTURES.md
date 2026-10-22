# Fixture semantics

All members, statements, searches, and suggested circles are fictional. Community names/links come from the event directory; fictional memberships do not assert that these people exist in those groups. Real community rows remain listed until genuine onboarding. Null descriptions and empty focus tags intentionally avoid invented community specialisms.

The sample discovery has no existing-community fit because no verified topic description was supplied. The interface must handle this by omitting that section.

Copy discover-response.sample.json into the mock adapter as a DiscoverResponse and search-preview.sample.json as SearchPreviewResponse. The fixture uses local retrieval, never claims an executed Cognee call. Tests can separately stub a Cognee response while retaining the same contract.

Create a host member in the platform seed. A circle initially has acceptedCount 1. Accepting two distinct invitations raises it to 3. Confirming the activity then makes it active. Pending invites do not count.

For a self-contained sample workspace, bootstrap.sample.json marks Unicorn Mafia and Kickstart as participating **only in fictional sample mode**. The base communities.sample.json keeps all real-directory statuses listed. Never apply the sample participation overrides to a live workspace.
