import React, { useContext, useState } from "react";
import style from "./SignIn_SignUp.module.css";
import { useFormik } from "formik";
import * as yup from "yup";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { HashLoader } from "react-spinners";
import { UserContext } from "../../Context/UserContext.jsx";
import { Helmet } from "react-helmet";
import { GlobalContext } from "../../Context/GlobalContext.jsx";

// Constants
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>/?\\|\[\]]).{8,}$/;

// Validation Schemas
const registerValidationSchema = yup.object({
  userName: yup
    .string()
    .min(3, "The minimum length for user name is 3 characters")
    .required("User name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  password: yup
    .string()
    .min(8, "The minimum length for password is 8 characters")
    .matches(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number and special character"
    )
    .required("Password is required"),
  acceptTerms: yup
    .boolean()
    .oneOf([true], "You must accept the Terms of Service and Privacy Policy")
    .required("You must accept the Terms of Service and Privacy Policy"),
});

const signInValidationSchema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
  password: yup
    .string()
    .min(8, "The minimum length for password is 8 characters")
    .matches(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number and special character"
    )
    .required("Password is required"),
});

// Social Icons Component
const SocialIcons = () => (
  <div className={style.social_icons}>
    <a href="#" className="icon">
      <i className="fa-brands fa-google-plus-g" />
    </a>
    <a href="#" className="icon">
      <i className="fa-brands fa-facebook-f" />
    </a>
    <a href="#" className="icon">
      <i className="fa-brands fa-github" />
    </a>
    <a href="#" className="icon">
      <i className="fa-brands fa-linkedin-in" />
    </a>
  </div>
);

// Form Input Component
const FormInput = ({ formik, name, type, placeholder }) => (
  <>
    <input
      onBlur={formik.handleBlur}
      onChange={formik.handleChange}
      value={formik.values[name]}
      name={name}
      type={type}
      placeholder={placeholder}
    />
    {formik.errors[name] && formik.touched[name] && (
      <p className="redAlert mt-0 mb-0">{formik.errors[name]}</p>
    )}
  </>
);

// SignUp Form Component
const SignUpForm = ({ formik, error, isLoading }) => (
  <div className={`${style.form_container} ${style.sign_up}`}>
    <form onSubmit={formik.handleSubmit}>
      <h1>Create Account</h1>
      <SocialIcons />
      <span>or use your email for registration</span>
      <FormInput
        formik={formik}
        name="userName"
        type="text"
        placeholder="Name"
      />
      <FormInput
        formik={formik}
        name="email"
        type="email"
        placeholder="Email"
      />
      <FormInput
        formik={formik}
        name="password"
        type="password"
        placeholder="Password"
      />
      <div className={style["checkbox-container"]}>
        <label className={`${style.checkbox_label}`}>
          <input
            type="checkbox"
            name="acceptTerms"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            checked={formik.values.acceptTerms}
            
          />
          <span>
            I agree to the{" "}
            <Link to="/terms">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy">Privacy Policy</Link>
          </span>
        </label>
      </div>
      {formik.errors.acceptTerms && formik.touched.acceptTerms && (
        <p className="redAlert mt-0 mb-0">{formik.errors.acceptTerms}</p>
      )}
      {error && <p className="redAlert mt-0 mb-0">{error}</p>}
      {isLoading ? (
        <button type="button">
          <HashLoader color="white" size={18} />
        </button>
      ) : (
        <button disabled={!(formik.isValid && formik.dirty)} type="submit">
          Sign Up
        </button>
      )}
    </form>
  </div>
);

// SignIn Form Component
const SignInForm = ({ formik, error, isLoading }) => (
  <div className={`${style.form_container} ${style.sign_in}`}>
    <form onSubmit={formik.handleSubmit}>
      <h1>Sign In</h1>
      <SocialIcons />
      <span>or use your email password</span>
      <FormInput
        formik={formik}
        name="email"
        type="email"
        placeholder="Email"
      />
      <FormInput
        formik={formik}
        name="password"
        type="password"
        placeholder="Password"
      />
      {error && <p className="redAlert mt-0 mb-0">{error}</p>}
      <Link to="/forgetpassword" className={style.forgotPasswordLink}>Forget Your Password?</Link>
      {isLoading ? (
        <button type="button">
          <HashLoader color="white" size={18} />
        </button>
      ) : (
        <button disabled={!(formik.isValid && formik.dirty)} type="submit">
          Sign In
        </button>
      )}
    </form>
  </div>
);

export default function SignIn_SignUp() {
  let {setUserToken} = useContext(UserContext);
  const navigate = useNavigate();
  const [registerError, setRegisterError] = useState("");
  const [signInError, setSignInError] = useState("");
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [isSignInLoading, setIsSignInLoading] = useState(false);

  const handleRegister = async (values) => {
    setIsRegisterLoading(true);
    try {
      const response = await axios.post(`http://localhost:3000/user/signUp`, values);      
      if (response.data?.success) {
        setIsRegisterLoading(false);
        removeActive();
      }
    } catch (error) {   
      setIsRegisterLoading(false);
      setRegisterError(error?.response?.data?.errMsg || "Registration failed");
    }
  };

  const handleSignIn = async (values) => {
    setIsSignInLoading(true);
    try {
      const response = await axios.post(`http://localhost:3000/user/signIn`, values);
      if (response.data?.success) {
        setIsSignInLoading(false);
        localStorage.setItem("userToken", response.data.token);
        setUserToken(response.data.token);
        navigate("/home");
      }
    } catch (error) {
      setIsSignInLoading(false);
      setSignInError(error?.response?.data?.errMsg || "Sign in failed");
    }
  }; 
  const registerFormik = useFormik({
    initialValues: {
      userName: "",
      email: "",
      password: "",
      acceptTerms: false,
    },
    validationSchema: registerValidationSchema,
    onSubmit: handleRegister
  });

  const signInFormik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: signInValidationSchema,
    onSubmit: handleSignIn
  });

  const setActive = () => {
    document.getElementById("container").classList.add(style.active);
  };

  const removeActive = () => {
    document.getElementById("container").classList.remove(style.active);
  };

  return <>
    <Helmet>
      <title>Sign In/Sign Up</title>
    </Helmet>
    <section className={style.signInBackGround}>
      <div className={style.animatedBg}></div>
      <div className={`${style.container} mb-10`} id="container">
        <SignUpForm
          formik={registerFormik}
          error={registerError}
          isLoading={isRegisterLoading}
        />
        <SignInForm
          formik={signInFormik}
          error={signInError}
          isLoading={isSignInLoading}
        />
        <div className={style.toggle_container}>
          <div className={style.toggle}>
            <div className={`${style.toggle_panel} ${style.toggle_left}`}>
              <h1>Welcome Back!</h1>
              <p>Enter your personal details to use all of site features</p>
              <button
                onClick={removeActive}
                className={style.hidden}
                id="login"
              >
                Sign In
              </button>
            </div>
            <div className={`${style.toggle_panel} ${style.toggle_right}`}>
              <h1>Hello, Friend!</h1>
              <p>
                Register with your personal details to use all of site features
              </p>
              <button
                onClick={setActive}
                className={style.hidden}
                id="register"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </>
}
