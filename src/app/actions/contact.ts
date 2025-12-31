// Re-export from canonical location for backwards compatibility with app routes
// Components should import from @/lib/actions/contact instead
export {
  createContact,
  updateContact,
  deleteContact,
  getContacts,
  searchContacts,
} from "@/lib/actions/contact"
