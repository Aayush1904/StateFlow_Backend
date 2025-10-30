import mongoose from 'mongoose';
import PageTemplateModel from '../models/pageTemplate.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

export const createTemplateService = async (
  workspaceId: string | null,
  userId: string,
  body: {
    name: string;
    description?: string;
    content: string;
    category: string;
    isDefault?: boolean;
  }
) => {
  const { name, description, content, category, isDefault = false } = body;

  // Only system admins can create default templates (workspaceId would be null)
  if (isDefault && workspaceId) {
    throw new BadRequestException('Only system templates can be marked as default');
  }

  const template = new PageTemplateModel({
    name,
    description,
    content,
    workspace: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
    category,
    isDefault,
    createdBy: new mongoose.Types.ObjectId(userId),
    updatedBy: new mongoose.Types.ObjectId(userId),
  });

  await template.save();

  return { template };
};

export const getTemplateByIdService = async (templateId: string) => {
  const template = await PageTemplateModel.findById(templateId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!template) {
    throw new NotFoundException('Template not found');
  }

  return { template };
};

export const getTemplatesByWorkspaceService = async (
  workspaceId: string | null,
  category?: string,
  userId?: string
) => {
  // Auto-seed default templates if they don't exist
  const existingDefaultCount = await PageTemplateModel.countDocuments({ isDefault: true });
  if (existingDefaultCount === 0 && userId) {
    try {
      await seedDefaultTemplatesService(userId);
    } catch (error) {
      console.error('Failed to auto-seed default templates:', error);
      // Continue even if seeding fails
    }
  }

  const query: any = {};

  if (workspaceId) {
    // Get workspace-specific templates and default templates
    query.$or = [
      { workspace: new mongoose.Types.ObjectId(workspaceId) },
      { isDefault: true },
    ];
  } else {
    // Get only default templates
    query.isDefault = true;
  }

  if (category) {
    query.category = category;
  }

  const templates = await PageTemplateModel.find(query)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ isDefault: -1, createdAt: -1 });

  return { templates };
};

export const updateTemplateService = async (
  templateId: string,
  userId: string,
  body: {
    name?: string;
    description?: string;
    content?: string;
    category?: string;
  }
) => {
  const { name, description, content, category } = body;

  const template = await PageTemplateModel.findById(templateId);
  if (!template) {
    throw new NotFoundException('Template not found');
  }

  // Prevent editing default templates unless user is the creator
  if (template.isDefault && template.createdBy.toString() !== userId) {
    throw new BadRequestException('Cannot edit default templates');
  }

  if (name !== undefined) {
    template.name = name;
  }

  if (description !== undefined) {
    template.description = description;
  }

  if (content !== undefined) {
    template.content = content;
  }

  if (category !== undefined) {
    template.category = category;
  }

  template.updatedBy = new mongoose.Types.ObjectId(userId);

  await template.save();

  return { template };
};

export const deleteTemplateService = async (templateId: string, userId: string) => {
  const template = await PageTemplateModel.findById(templateId);
  if (!template) {
    throw new NotFoundException('Template not found');
  }

  // Prevent deleting default templates unless user is the creator
  if (template.isDefault && template.createdBy.toString() !== userId) {
    throw new BadRequestException('Cannot delete default templates');
  }

  await PageTemplateModel.findByIdAndDelete(templateId);

  return { message: 'Template deleted successfully' };
};

// Seed default templates
export const seedDefaultTemplatesService = async (userId: string) => {
  const defaultTemplates = [
    {
      name: 'Meeting Notes',
      description: 'Professional template for recording meeting notes with action items and decisions',
      content: `# Meeting Notes

## 📅 Meeting Details

**Date:** [Date]  
**Time:** [Start Time] - [End Time]  
**Location:** [Physical/Virtual Location]  
**Meeting Type:** [Team Sync / Planning / Review / Other]

---

## 👥 Attendees

| Name | Role | Status |
|------|------|--------|
| | | Present |
| | | Present |
| | | Absent |

---

## 📋 Agenda

1. **Item 1** - [Brief description]
2. **Item 2** - [Brief description]
3. **Item 3** - [Brief description]

---

## 💬 Discussion Points

### Topic 1: [Topic Name]
- Key point discussed
- Decision made
- Open questions

### Topic 2: [Topic Name]
- Key point discussed
- Decision made
- Open questions

---

## ✅ Action Items

| Task | Owner | Due Date | Status |
|------|-------|----------|--------|
| [ ] Action item 1 | [Name] | [Date] | Not Started |
| [ ] Action item 2 | [Name] | [Date] | Not Started |
| [ ] Action item 3 | [Name] | [Date] | Not Started |

---

## 📌 Key Decisions

1. **Decision 1:** [Description]
   - Rationale: [Why this decision was made]
   - Impact: [What this affects]

2. **Decision 2:** [Description]
   - Rationale: [Why this decision was made]
   - Impact: [What this affects]

---

## 📝 Additional Notes

> **Important:** [Any critical information or reminders]

- Additional context or notes
- Follow-up items
- Resources shared: [Links or references]

---

## ➡️ Next Steps

- [ ] Task before next meeting
- [ ] Preparation needed
- [ ] Follow-up scheduled

---

## 📅 Next Meeting

**Scheduled:** [Date] at [Time]  
**Focus:** [What will be discussed]
`,
      category: 'meeting-notes',
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    },
    {
      name: 'Sprint Retrospective',
      description: 'Comprehensive sprint retrospective template with metrics and improvement actions',
      content: `# Sprint Retrospective

## 🎯 Sprint Overview

**Sprint Name:** [Sprint Name]  
**Sprint Duration:** [Start Date] - [End Date]  
**Team:** [Team Name]  
**Sprint Goal:** [Primary objective]

---

## 📊 Sprint Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Story Points Planned | | | |
| Story Points Completed | | | |
| Velocity | | | |
| Burndown | | | |

---

## 🌟 What Went Well

### Successes
- ✅ [Achievement 1]
- ✅ [Achievement 2]
- ✅ [Achievement 3]

### Highlights
> **Quote or notable moment from the sprint**

### Team Kudos
- [Name] did an excellent job on [achievement]
- [Name] helped with [contribution]

---

## 🚧 What Could Be Improved

### Challenges
- ❌ [Challenge 1]
  - Impact: [How it affected the sprint]
  - Root cause: [Why it happened]

- ❌ [Challenge 2]
  - Impact: [How it affected the sprint]
  - Root cause: [Why it happened]

### Blockers Encountered
| Blocker | Owner | Resolution | Prevent Future? |
|---------|-------|------------|-----------------|
| [Description] | [Name] | [How resolved] | Yes/No |
| [Description] | [Name] | [How resolved] | Yes/No |

---

## 💡 Action Items

| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [ ] Action item 1 | [Name] | High/Medium/Low | [Date] |
| [ ] Action item 2 | [Name] | High/Medium/Low | [Date] |
| [ ] Action item 3 | [Name] | High/Medium/Low | [Date] |

---

## 🗣️ Team Feedback

### Anonymous Feedback
> "[Feedback quote]"

### Suggestions
1. **Suggestion 1:** [Description]
2. **Suggestion 2:** [Description]
3. **Suggestion 3:** [Description]

---

## 🎯 Goals for Next Sprint

### Sprint Goal
[Primary objective for next sprint]

### Focus Areas
1. **Focus Area 1:** [Description]
2. **Focus Area 2:** [Description]

### Team Commitments
- [ ] Commitment 1
- [ ] Commitment 2
- [ ] Commitment 3

---

## 📸 Sprint Highlights

> Add images, screenshots, or visual references from the sprint here

**Demo Links:**
- [Feature 1 Demo](link)
- [Feature 2 Demo](link)
`,
      category: 'sprint-retro',
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    },
    {
      name: 'Daily Standup',
      description: 'Structured daily standup template with progress tracking',
      content: `# Daily Standup

## 📅 Date: [Date]

**Team:** [Team Name]  
**Scrum Master:** [Name]  
**Sprint:** [Sprint Name]

---

## ✅ What I Accomplished Yesterday

### Completed Tasks
1. ✅ [Task 1] - [Brief description]
2. ✅ [Task 2] - [Brief description]
3. ✅ [Task 3] - [Brief description]

### Progress Made
- [Achievement 1]
- [Achievement 2]

### Blockers Resolved
- ✅ [Blocker that was resolved]

---

## 🎯 What I'm Working On Today

### Priority Tasks
1. **High Priority:** [Task description]
   - Expected outcome: [What will be completed]
   
2. **Medium Priority:** [Task description]
   - Expected outcome: [What will be completed]

3. **Low Priority:** [Task description]
   - Expected outcome: [What will be completed]

### Focus Areas
- [ ] Focus area 1
- [ ] Focus area 2

---

## 🚧 Blockers & Impediments

| Blocker | Impact | Need Help From | Status |
|---------|--------|----------------|--------|
| [Description] | High/Medium/Low | [Name/Team] | Active/Resolved |
| [Description] | High/Medium/Low | [Name/Team] | Active/Resolved |

### Need Help With
- [ ] [Specific help needed]
- [ ] [Specific help needed]

---

## 📊 Progress Update

### Story Points Completed
- Yesterday: [X] points
- Today Target: [X] points
- Sprint Progress: [X]% complete

### Key Metrics
| Metric | Value | Change |
|--------|-------|--------|
| Tasks Completed | | +X |
| Blockers Resolved | | +X |
| Code Reviews Done | | +X |

---

## 💬 Notes & Updates

### Important Announcements
> [Any important information for the team]

### Dependencies
- Waiting on: [Name/Team] for [What]
- Providing to: [Name/Team] for [What]

### Collaboration
- **Pairing with:** [Name] on [Task]
- **Code Review:** [PR link or description]

---

## 🔄 Follow-up Items

- [ ] Follow-up action 1
- [ ] Follow-up action 2

---

## 📅 Tomorrow's Focus

**Primary Goal:** [Main focus for tomorrow]
**Key Tasks:** [Top 3 tasks]
`,
      category: 'daily-standup',
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    },
    {
      name: 'Project Plan',
      description: 'Comprehensive project planning template with timeline, resources, and risk management',
      content: `# Project Plan

## 📋 Project Overview

**Project Name:** [Project Name]  
**Project Code:** [Project Code/ID]  
**Start Date:** [Start Date]  
**Target End Date:** [End Date]  
**Project Manager:** [Name]  
**Status:** 🟢 Planning / 🟡 In Progress / 🔴 On Hold

---

## 🎯 Project Objectives

### Primary Goals
1. **Goal 1:** [Description]
   - Success metric: [How to measure]
   - Deadline: [Date]

2. **Goal 2:** [Description]
   - Success metric: [How to measure]
   - Deadline: [Date]

3. **Goal 3:** [Description]
   - Success metric: [How to measure]
   - Deadline: [Date]

### Business Value
> [Why this project matters and expected ROI]

---

## 👥 Team Members

| Name | Role | Responsibility | Time Allocation |
|------|------|----------------|-----------------|
| [Name] | [Role] | [Key responsibilities] | [X]% |
| [Name] | [Role] | [Key responsibilities] | [X]% |
| [Name] | [Role] | [Key responsibilities] | [X]% |

### Stakeholders
- **Project Sponsor:** [Name]
- **Key Stakeholders:** [Names]
- **End Users:** [Target audience]

---

## 🗓️ Key Milestones

| Milestone | Description | Target Date | Status | Owner |
|-----------|-------------|-------------|--------|-------|
| M1 | [Description] | [Date] | Not Started | [Name] |
| M2 | [Description] | [Date] | Not Started | [Name] |
| M3 | [Description] | [Date] | Not Started | [Name] |
| M4 | [Description] | [Date] | Not Started | [Name] |

---

## 📅 Project Timeline

### Phase 1: [Phase Name]
**Duration:** [Start] - [End]  
**Deliverables:**
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] Deliverable 3

**Key Activities:**
1. Activity 1
2. Activity 2
3. Activity 3

### Phase 2: [Phase Name]
**Duration:** [Start] - [End]  
**Deliverables:**
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] Deliverable 3

**Key Activities:**
1. Activity 1
2. Activity 2
3. Activity 3

### Phase 3: [Phase Name]
**Duration:** [Start] - [End]  
**Deliverables:**
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] Deliverable 3

**Key Activities:**
1. Activity 1
2. Activity 2
3. Activity 3

---

## 💰 Resources Needed

### Budget
| Category | Estimated Cost | Actual Cost | Notes |
|----------|---------------|-------------|-------|
| Software/Tools | $[Amount] | $[Amount] | |
| Infrastructure | $[Amount] | $[Amount] | |
| External Services | $[Amount] | $[Amount] | |
| **Total** | **$[Amount]** | **$[Amount]** | |

### Tools & Software
- [Tool 1] - [Purpose]
- [Tool 2] - [Purpose]
- [Tool 3] - [Purpose]

### External Resources
- Vendor/Consultant: [Name/Company] - [What they provide]
- Third-party service: [Service name] - [Usage]

---

## ⚠️ Risks & Mitigation

| Risk | Probability | Impact | Severity | Mitigation Strategy | Owner |
|------|------------|--------|----------|---------------------|-------|
| [Risk description] | High/Medium/Low | High/Medium/Low | Critical/High/Medium/Low | [Strategy] | [Name] |
| [Risk description] | High/Medium/Low | High/Medium/Low | Critical/High/Medium/Low | [Strategy] | [Name] |
| [Risk description] | High/Medium/Low | High/Medium/Low | Critical/High/Medium/Low | [Strategy] | [Name] |

### Contingency Plans
- **If [Scenario]:** [Action plan]
- **If [Scenario]:** [Action plan]

---

## ✅ Success Criteria

### Must Have
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Should Have
- [ ] Criterion 1
- [ ] Criterion 2

### Nice to Have
- [ ] Criterion 1
- [ ] Criterion 2

### KPIs
| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| [Metric 1] | [Target value] | [How to measure] |
| [Metric 2] | [Target value] | [How to measure] |
| [Metric 3] | [Target value] | [How to measure] |

---

## 🔗 Dependencies

### External Dependencies
- **Dependency 1:** [Description]
  - Owner: [Name/Team]
  - Required by: [Date]
  
- **Dependency 2:** [Description]
  - Owner: [Name/Team]
  - Required by: [Date]

### Internal Dependencies
- [Dependency description]
- [Dependency description]

---

## 📊 Project Status Dashboard

### Current Status
- **Overall Progress:** [X]%
- **On Track:** ✅ / ⚠️ / ❌
- **Next Review:** [Date]

### Recent Updates
- [Date]: [Update]
- [Date]: [Update]
- [Date]: [Update]

---

## 📝 Notes & Documentation

### Important Links
- [Project Repository](link)
- [Design Documents](link)
- [Meeting Notes](link)

### Additional Resources
- [Resource 1](link)
- [Resource 2](link)
`,
      category: 'project-plan',
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    },
  ];

  // Check if default templates already exist
  const existingCount = await PageTemplateModel.countDocuments({ isDefault: true });
  if (existingCount > 0) {
    return { message: 'Default templates already exist', templates: [] };
  }

  const templates = await PageTemplateModel.insertMany(defaultTemplates);
  return { message: 'Default templates seeded successfully', templates };
};

