import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./Components/Layout/Layout";
import Home from "./Components/Home/Home";
import NotFound from "./Components/NotFound/NotFound";
import Results from "./Components/Results/Results";
import SignIn_SignUp from "./Components/SignIn_SignUp/SignIn_SignUp";
import UserProfile from "./Components/UserProfile/UserProfile";
import ContactSupport from "./Components/ContactSupport/ContactSupport";
import ForgetPassword from "./Components/ForgetPassword/ForgetPassword";
import ScannerInput from "./Components/Scanner/ScannerInput";
import UserContextProvider from "./Context/UserContext";


let routers = createBrowserRouter([
  {
    path: '', element: <Layout />, children: [
      { index: true, element: <Home /> },
      { path: 'home', element: <Home /> },
      { path: 'scanner', element: <ScannerInput /> },
      { path: 'forgetpassword', element: <ForgetPassword /> },
      { path: 'results', element: <Results /> },
      { path: 'signin', element: <SignIn_SignUp /> },
      { path: 'profile', element: <UserProfile /> },
      { path: '*', element: <NotFound /> },
      { path: 'contactsupport', element: < ContactSupport /> }
    ]
  }
]);

function App() {
  return <UserContextProvider>
    <RouterProvider router={routers}></RouterProvider>
  </UserContextProvider>

}

export default App
