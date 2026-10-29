# Spec Delta

## Purpose

Lets a firm see the questions its client asks Haven's AI and the answers it gives, after the client has been clearly told, so the lawyer can confirm or correct the AI and every AI answer is labeled as possibly wrong.

## ADDED Requirements

### Requirement: Client is asked if they want AI answers in Ask
When a firm client opens Ask (`/advisor`) to message their lawyer, Haven SHALL ask whether they want AI answers (`Yes` or `No`), and let them toggle this choice later. If they say `Yes`, Haven SHALL tell them that the AI will answer first, that it may not be 100% accurate, and that their lawyer will respond once they see the message, and SHALL record the time of acknowledgement. If they say `No`, their messages SHALL be sent directly to their lawyer without generating an AI answer.

#### Scenario: Client says Yes to AI answers
- **WHEN** a firm client chooses "Yes" to AI answers in Ask
- **THEN** they see that the AI will answer first, that it may not be 100% accurate, and that their lawyer will respond once they see the message, and sending a message produces an AI answer first while also sending the message to their lawyer

#### Scenario: Client says No to AI answers
- **WHEN** a firm client chooses "No" to AI answers in Ask and sends a message
- **THEN** the message is sent directly to their lawyer and no AI answer is generated

#### Scenario: Client leaves Ask while AI is answering
- **WHEN** a client sends a question in Ask with AI answers enabled and navigates away from `/advisor` before the AI finishes
- **THEN** the AI continues generating in the background, saves the completed answer to the conversation, and when the client returns to `/advisor` their AI preference and the streaming or completed AI answer appear in the conversation

#### Scenario: Client not connected to any firm
- **WHEN** a person with no firm uses the AI chat
- **THEN** no lawyer prompt is shown and nothing is shared

### Requirement: Only chats after the notice are shared
A firm SHALL see only AI chat conversations started after the client acknowledged the notice. Conversations from before SHALL stay private to the client.

#### Scenario: Old conversation
- **WHEN** a client had an AI chat in September and acknowledges the notice in November
- **THEN** the firm sees none of the September chat

#### Scenario: Old conversation continued
- **WHEN** the client adds a new question to the September chat after acknowledging
- **THEN** the firm still sees none of that conversation

### Requirement: Chat is framed as asking the lawyer
For a firm client, the AI chat SHALL be presented as asking their lawyer a question, with the AI answering first. Every chat screen SHALL show a short line saying so and naming the firm(s), and the question box SHALL invite a question to the lawyer.

#### Scenario: Client opens a shared chat
- **WHEN** a firm client opens any shared AI chat
- **THEN** a line reads "Your lawyer at [Firm] sees these questions. Haven's AI answers first." and the question box reads "Ask your lawyer a question"

#### Scenario: Client with two firms
- **WHEN** a client connected to Firm A and Firm B opens the chat
- **THEN** the line names both firms

#### Scenario: Person without a firm
- **WHEN** a person with no firm opens the AI chat
- **THEN** the chat is presented as it is today, with no mention of a lawyer seeing it

### Requirement: New firm means a new notice
When a client connects to an additional firm, Haven SHALL show the notice again naming the new firm before the client's next AI chat message. The new firm SHALL see only conversations started after that acknowledgement.

#### Scenario: Client joins a second firm
- **WHEN** a client who acknowledged for Firm A joins Firm B
- **THEN** the next chat shows the notice naming Firm A and Firm B, and Firm B sees no conversations started before that acknowledgement

### Requirement: Every AI answer is labeled
Every AI answer shown to a firm client SHALL carry the label "AI can make mistakes. Your lawyer may reach out to confirm this." The same label SHALL appear on each AI answer when a lawyer views it.

#### Scenario: Any answer
- **WHEN** the AI answers any question for a firm client
- **THEN** the label appears under that answer

#### Scenario: Person without a firm
- **WHEN** the AI answers someone with no firm
- **THEN** the label reads "AI can make mistakes. Check important decisions with an immigration lawyer."

### Requirement: Lawyer sees shared chats read-only
The client's page on the firm dashboard SHALL list the client's shared AI chats, newest first, with each question and answer in order. Lawyers SHALL NOT be able to edit or delete them, and SHALL NOT see the AI's internal notes or sources beyond what the client saw.

#### Scenario: Lawyer opens a chat
- **WHEN** a lawyer opens one of the client's shared AI chats
- **THEN** they see the client's questions and the AI's answers exactly as the client saw them, with times

### Requirement: Lawyer replies to a specific AI answer
A lawyer SHALL be able to reply to a specific AI answer. The reply SHALL go into the client's direct conversation with that firm, quoting the start of the answer it refers to, and SHALL trigger the usual alert email.

#### Scenario: Lawyer corrects an answer
- **WHEN** a lawyer replies "This isn't right for your case, let's talk Tuesday" on an AI answer
- **THEN** the client sees the reply in their Messages with a link back to that AI answer

### Requirement: Client deleting a chat removes it for the firm
If the client deletes a shared AI chat, firms SHALL no longer see it. Lawyer replies already sent about it SHALL remain in the direct conversation without the quoted text.

#### Scenario: Client deletes
- **WHEN** a client deletes a shared AI chat
- **THEN** the chat disappears from the firm's view, and earlier lawyer replies about it show "The AI chat this refers to was deleted"

### Requirement: Firm isolation for shared chats
A firm SHALL see a client's shared AI chats only while the client is connected to that firm.

#### Scenario: Client disconnected from a firm
- **WHEN** a client's connection to a firm is removed
- **THEN** that firm can no longer see any of the client's AI chats
