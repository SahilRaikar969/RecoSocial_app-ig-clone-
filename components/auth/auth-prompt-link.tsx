import type {ReactNode} from 'react'
import {NavigationLink as Link} from '@/components/ui/navigation-link'
import {safeReturnPath} from '@/lib/routes/safe-return-path'
export function AuthPromptLink({returnTo,action,children,className='rs-button'}:{returnTo:string;action:string;children:ReactNode;className?:string}) {
  const query=new URLSearchParams({next:safeReturnPath(returnTo),reason:action})
  return <Link href={'/login?'+query} className={className}>{children}</Link>
}
