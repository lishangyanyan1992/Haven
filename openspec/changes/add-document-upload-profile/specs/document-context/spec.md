# Spec Delta

## Purpose

Lets a user keep their immigration documents in Haven and lets the chat answer from them, always saying which document an answer came from.

## ADDED Requirements

### Requirement: User can upload, list and delete documents
The vault SHALL let a signed-in user upload a document, see their documents, and delete any of them. Accepted files are PDF, JPG, PNG, WebP, GIF and plain text up to 15 MB.

#### Scenario: Upload
- **WHEN** the user uploads a PDF of an I-797 notice
- **THEN** it appears in their list with its name, size and upload date

#### Scenario: Unsupported file
- **WHEN** the user uploads a Word or HEIC file
- **THEN** the upload is refused with a message asking them to save it as a PDF or JPG

#### Scenario: Delete
- **WHEN** the user deletes a document
- **THEN** it disappears from the list and the chat can no longer use anything from it

### Requirement: The vault says how documents are used
The vault page SHALL tell the user, before they upload, that documents are sent to OpenAI to be read and are used only to answer their own questions.

#### Scenario: First visit
- **WHEN** a user opens the vault
- **THEN** the note is visible above the upload button

### Requirement: Documents become searchable after upload
After upload, the system SHALL read the document in the background and make its contents searchable for that user. The list SHALL show whether each document is ready, still being read, waiting for tomorrow's limit, or could not be read.

#### Scenario: Readable document
- **WHEN** a readable PDF is uploaded
- **THEN** it shows as ready once reading finishes, without the user doing anything

#### Scenario: Unreadable document
- **WHEN** the document is blank, password-protected, or illegible
- **THEN** it shows "could not be read" with a plain reason, and stays in the vault

#### Scenario: Daily limit reached
- **WHEN** the user has used up the day's reading limit
- **THEN** the document shows "will be read tomorrow" and is read the next day without re-uploading

### Requirement: Chat answers from the user's own documents
When a signed-in user asks a question, the system SHALL look up the passages from that user's documents most relevant to the question and make them available to the Advisor.

#### Scenario: Relevant document
- **WHEN** a user whose I-94 is in the vault asks until when they can stay
- **THEN** the answer uses the date printed on the I-94

#### Scenario: Nothing relevant
- **WHEN** none of the user's documents relate to the question
- **THEN** the answer is the same as it would be with no documents

### Requirement: Answers that use a document cite it
When an answer relies on a passage from the user's documents, the answer MUST name the document and page it came from.

#### Scenario: Citation
- **WHEN** an answer uses a date from the user's I-797
- **THEN** it says which document and page, e.g. "your I-797 approval notice (page 1)"

### Requirement: Documents are private to their owner
The system SHALL make a user's documents and their searchable contents available only to that user and to the chat when answering that user. No other user's question can retrieve them.

#### Scenario: Another user
- **WHEN** another user asks the chat a question
- **THEN** nothing from this user's documents is retrieved

#### Scenario: Signed out
- **WHEN** someone who is not signed in requests document contents
- **THEN** nothing is returned
