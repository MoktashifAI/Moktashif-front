import { useState } from "react"
import { Link, Outlet } from "react-router-dom"
import style from './NotFound.module.css';
import { Helmet } from "react-helmet";
export default function NotFound() {

    const [outletFlag,setOutletFlag] = useState(false);

    const toggleOutle = ()=>{
        setOutletFlag(!outletFlag);
    }

    return (
        <>
        <Helmet>
            <title>Not Found</title>
        </Helmet>
        {/* {outletFlag?<Outlet></Outlet>:<main className="grid min-h-full place-items-center bg-white px-6 py-24 sm:py-32 lg:px-8">
                <div className="text-center">
                    <p className="text-base font-semibold text-indigo-600">404</p>
                    <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
                        Page not found
                    </h1>
                    <p className="mt-6 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
                        Sorry, we couldn’t find the page you’re looking for.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <Link
                        onClick={toggleOutle}
                            to={'/home'}
                            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Go back home
                        </Link>
                        <Link onClick={toggleOutle} to={'/contactsupport'} className="text-sm font-semibold text-gray-900">
                            Contact support <span aria-hidden="true">&rarr;</span>
                        </Link>
                    </div>
                </div>
            </main>} */}
            <section className={`${style.NotFoundBackGround} grid min-h-full place-items-center  px-6 py-24 sm:py-32 lg:px-8`}>
                <div className="text-center">
                    <p className={`text-base font-semibold ${style.notfoundCode}`}>404</p>
                    <h1 className={`${style.notFoundH1} mt-4 text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl`}>
                        Page not found
                    </h1>
                    <p className="mt-6 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
                        Sorry, we couldn’t find the page you’re looking for.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <Link
                            to={'/home'}
                            className={` ${style.notfoundButton} rounded-md  px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2`}
                        >
                            Go back home
                        </Link>
                        <Link to={'/contactsupport'} className="text-sm font-semibold text-gray-900">
                            Contact support <span aria-hidden="true">&rarr;</span>
                        </Link>
                    </div>
                </div>
            </section>
        </>
    )
}
