---
name: enable-required-mcps
description: CRITICAL - Always verify and enable Supabase and Context7 MCPs before ANY database or context operations
triggers:
  - When starting any conversation or session
  - Before any Supabase database operations
  - Before any context retrieval operations
  - When encountering database connection errors
  - When analytics or data queries fail
---

# 🚨 CRITICAL: Required MCP Verification

**This skill MUST be executed at the start of EVERY session and before ANY database operations.**

## Required MCPs

You **MUST** verify that these MCPs are enabled and functional:

### 1. ✅ Supabase MCP (`@supabase`)

**Purpose**: Direct database access to Supabase PostgreSQL
**When needed**:

- Executing SQL queries
- Database migrations
- Analytics queries
- Data verification
- Debugging database issues

### 2. ✅ Context7 MCP (`@context7`)

**Purpose**: Advanced context retrieval and semantic search
**When needed**:

- Finding related code
- Understanding codebase context
- Semantic code search
- Documentation lookup

## Verification Checklist

Before proceeding with ANY database or analytics work, verify:

- [ ] Supabase MCP is available in the MCP list
- [ ] Supabase MCP connection is active
- [ ] Can execute simple query (e.g., `SELECT 1`)
- [ ] Context7 MCP is available (if needed for context)

## How to Check MCP Availability

1. **List available MCPs**: Check if `@supabase` and `@context7` appear in the available tools
2. **Test connection**: Try a simple query to verify connectivity
3. **If missing**: STOP and inform the user that MCPs need to be enabled

## What to Do if MCPs are NOT Enabled

**DO NOT PROCEED** with database operations if MCPs are missing. Instead:

1. **STOP immediately**
2. **Inform the user clearly**:

   ```
   ⚠️ CRITICAL: Required MCPs are not enabled

   To proceed with database operations, please enable:
   - Supabase MCP: For database access
   - Context7 MCP: For enhanced context retrieval

   Please enable these MCPs and restart the conversation.
   ```

## When This Skill Should Be Used

✅ **USE THIS SKILL:**

- At the start of EVERY conversation
- Before executing ANY SQL queries
- Before analytics operations
- When database errors occur
- When migrating or fixing database issues

❌ **DO NOT SKIP:**

- Never assume MCPs are enabled
- Never proceed with database operations without verification
- Never ignore MCP connection errors

## Example Usage

### Good Pattern ✅

```
1. User: "Fix the analytics page"
2. Assistant: *Checks MCP availability*
3. Assistant: *Verifies Supabase MCP is enabled*
4. Assistant: *Executes SQL fix using Supabase MCP*
```

### Bad Pattern ❌

```
1. User: "Fix the analytics page"
2. Assistant: *Creates SQL file and tells user to run it manually*
   (Should have used Supabase MCP instead!)
```

## Integration with Other Skills

This skill should run **BEFORE**:

- Any database troubleshooting
- Analytics fixes
- Migration execution
- Data verification
- Performance optimization

## Success Criteria

✅ **Success**: MCPs are enabled and working, proceed with database operations
❌ **Failure**: MCPs are missing, STOP and inform user

## Priority Level

**🔴 CRITICAL - HIGHEST PRIORITY**

This is a blocking requirement. No database work can proceed without verified MCP access.

---

**Remember**: Always verify MCP availability FIRST, before creating SQL scripts or manual workarounds!
