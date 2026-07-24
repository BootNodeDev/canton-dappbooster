import { CreateAccountForm } from '@/components/CreateAccountForm'
import { Card } from '@/components/ui/Card'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import { ImportVaultForm } from '@/components/VaultBackupPanel'

// Step 3 of onboarding. The vault exists and is unlocked, so a restore here merges the
// backup's accounts under the new local vault password (decrypting with the file's own
// password). Restore reuses the dashboard import; it never creates a Canton party.
export const CreateFirstAccount = (): JSX.Element => (
  <Card>
    <Tabs defaultValue="create">
      <TabsList className="mb-4">
        <TabTrigger
          value="create"
          testId="onboarding-tab-create"
        >
          Create new account
        </TabTrigger>
        <TabTrigger
          value="restore"
          testId="onboarding-tab-restore"
        >
          Restore from backup
        </TabTrigger>
      </TabsList>
      <TabContent value="create">
        <CreateAccountForm showIntro />
      </TabContent>
      <TabContent value="restore">
        <ImportVaultForm />
      </TabContent>
    </Tabs>
  </Card>
)
