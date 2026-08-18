# CRM Context

This context defines the records that connect people, companies, deals, and communication history.

## Language

**Communication**:
A phone call or message stored independently from its provider delivery events.
_Avoid_: Quo activity, provider event

**Participant**:
A CRM user, contact, or unresolved phone number involved in a communication.
_Avoid_: Caller, recipient

**Artifact**:
A recording, voicemail, summary, next step, or transcript attached to a communication.
_Avoid_: Attachment, call data

**Activity**:
A communication projection shown on a contact, company, or deal timeline.
_Avoid_: Communication record

**Contact phone**:
A normalized phone number that belongs to a contact and supports exact communication matching.
_Avoid_: Phone string

**Needs review**:
A communication with no unique contact match.
_Avoid_: Unmatched activity, unknown call

**Connection**:
The single account-level authorization that connects a CRM workspace to Quo.
_Avoid_: User integration
